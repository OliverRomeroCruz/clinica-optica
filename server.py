import http.server
import socketserver
import json
import sqlite3
import hashlib
import secrets
import os
import re

PORT = 8088
DB_FILE = os.path.join(os.path.dirname(__file__), 'database.db')

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            correo TEXT UNIQUE NOT NULL COLLATE NOCASE,
            contrasena TEXT NOT NULL,
            salt TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'cliente',
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print(f"Base de datos SQLite inicializada en: {DB_FILE}")

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()

class OpticaAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve static files from the script directory
        directory = os.path.dirname(os.path.abspath(__file__))
        super().__init__(*args, directory=directory, **kwargs)

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/register':
            self.handle_register()
        elif self.path == '/api/login':
            self.handle_login()
        else:
            self._send_json(404, {'ok': False, 'error': 'Ruta de API no encontrada'})

    def do_GET(self):
        if self.path == '/api/usuarios':
            self.handle_list_users()
        elif self.path.startswith('/api/'):
            self._send_json(404, {'ok': False, 'error': 'Endpoint no encontrado'})
        else:
            super().do_GET()

    def handle_register(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            nombre = (data.get('nombre') or '').strip()
            correo = (data.get('correo') or '').strip().lower()
            contrasena = data.get('contrasena') or ''
            rol = (data.get('rol') or 'cliente').strip().lower()

            # Validations
            if not nombre or not correo or not contrasena:
                return self._send_json(400, {'ok': False, 'error': 'Todos los campos son obligatorios.'})

            if len(contrasena) < 6:
                return self._send_json(400, {'ok': False, 'error': 'La contraseña debe tener al menos 6 caracteres.'})

            if not re.match(r"[^@]+@[^@]+\.[^@]+", correo):
                return self._send_json(400, {'ok': False, 'error': 'El correo electrónico no es válido.'})

            roles_permitidos = ['cliente', 'optometrista', 'administrador', 'recepcion']
            if rol not in roles_permitidos:
                rol = 'cliente'

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()

            # Check if email exists
            cursor.execute("SELECT id FROM usuarios WHERE correo = ?", (correo,))
            if cursor.fetchone():
                conn.close()
                return self._send_json(409, {'ok': False, 'error': 'Este correo ya está registrado.'})

            # Create salt and hash
            salt = secrets.token_hex(16)
            password_hash = hash_password(contrasena, salt)

            cursor.execute('''
                INSERT INTO usuarios (nombre, correo, contrasena, salt, rol)
                VALUES (?, ?, ?, ?, ?)
            ''', (nombre, correo, password_hash, salt, rol))
            conn.commit()
            user_id = cursor.lastrowid
            conn.close()

            print(f"Nuevo usuario registrado: {nombre} ({correo}) - Rol: {rol}")
            self._send_json(201, {
                'ok': True,
                'mensaje': 'Registro completado con éxito',
                'usuario': {
                    'id': user_id,
                    'nombre': nombre,
                    'correo': correo,
                    'rol': rol
                }
            })

        except Exception as e:
            print("Error en registro:", e)
            self._send_json(500, {'ok': False, 'error': f'Error interno del servidor: {str(e)}'})

    def handle_login(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            correo = (data.get('correo') or '').strip().lower()
            contrasena = data.get('contrasena') or ''

            if not correo or not contrasena:
                return self._send_json(400, {'ok': False, 'error': 'Por favor introduce correo y contraseña.'})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, nombre, correo, contrasena, salt, rol, fecha_registro
                FROM usuarios
                WHERE correo = ?
            ''', (correo,))
            user = cursor.fetchone()
            conn.close()

            if not user:
                return self._send_json(401, {'ok': False, 'error': 'Correo o contraseña incorrectos.'})

            user_id, nombre, email, stored_hash, salt, rol, fecha_reg = user
            computed_hash = hash_password(contrasena, salt)

            if computed_hash != stored_hash:
                return self._send_json(401, {'ok': False, 'error': 'Correo o contraseña incorrectos.'})

            print(f"Inicio de sesión exitoso: {nombre} ({email}) - Rol: {rol}")
            self._send_json(200, {
                'ok': True,
                'mensaje': 'Acceso concedido',
                'usuario': {
                    'id': user_id,
                    'nombre': nombre,
                    'correo': email,
                    'rol': rol,
                    'fecha_registro': fecha_reg
                }
            })

        except Exception as e:
            print("Error en login:", e)
            self._send_json(500, {'ok': False, 'error': f'Error interno del servidor: {str(e)}'})

    def handle_list_users(self):
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute('SELECT id, nombre, correo, rol, fecha_registro FROM usuarios ORDER BY id DESC')
            rows = cursor.fetchall()
            conn.close()

            usuarios = [
                {
                    'id': r[0],
                    'nombre': r[1],
                    'correo': r[2],
                    'rol': r[3],
                    'fecha_registro': r[4]
                }
                for r in rows
            ]
            self._send_json(200, {'ok': True, 'usuarios': usuarios})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

if __name__ == '__main__':
    init_db()
    server = socketserver.TCPServer(("", PORT), OpticaAPIHandler)
    server.allow_reuse_address = True
    print(f"Servidor de Clínica Óptica con API SQLite activo en: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
