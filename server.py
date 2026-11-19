import http.server
import socketserver
import json
import sqlite3
import hashlib
import secrets
import os
import re
from urllib.parse import urlparse, parse_qs

PORT = 8088
DB_FILE = os.path.join(os.path.dirname(__file__), 'database.db')

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. Tabla Usuarios
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

    # 2. Tabla Pedidos (Productos de clientes gestionados por Admin)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            producto TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'Gafas',
            estado TEXT NOT NULL DEFAULT 'Pendiente',
            notas TEXT,
            fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    ''')

    # 3. Tabla Citas ("Fechas de quedada" del cliente)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS citas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            servicio TEXT NOT NULL,
            fecha_cita TEXT NOT NULL,
            hora_cita TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'Confirmada',
            fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    ''')

    # 4. Crear Perfil Administrador por defecto si no existe
    cursor.execute("SELECT id FROM usuarios WHERE correo = 'admin@clinicaoptica.com'")
    if not cursor.fetchone():
        admin_salt = secrets.token_hex(16)
        admin_hash = hash_password('admin123', admin_salt)
        cursor.execute('''
            INSERT INTO usuarios (nombre, correo, contrasena, salt, rol)
            VALUES (?, ?, ?, ?, ?)
        ''', ('Administrador de Clínica', 'admin@clinicaoptica.com', admin_hash, admin_salt, 'admin'))
        print("Perfil Administrador creado: admin@clinicaoptica.com / admin123")

    # 5. Crear un Cliente de muestra con datos para pruebas inmediatas si no existe
    cursor.execute("SELECT id FROM usuarios WHERE correo = 'carlos@cliente.com'")
    carlos_user = cursor.fetchone()
    if not carlos_user:
        carlos_salt = secrets.token_hex(16)
        carlos_hash = hash_password('cliente123', carlos_salt)
        cursor.execute('''
            INSERT INTO usuarios (nombre, correo, contrasena, salt, rol)
            VALUES (?, ?, ?, ?, ?)
        ''', ('Carlos Mendoza', 'carlos@cliente.com', carlos_hash, carlos_salt, 'cliente'))
        carlos_id = cursor.lastrowid
        print("Perfil Cliente de muestra creado: carlos@cliente.com / cliente123")

        # Pedidos de muestra para Carlos
        cursor.execute('''
            INSERT INTO pedidos (usuario_id, producto, tipo, estado, notas)
            VALUES (?, ?, ?, ?, ?)
        ''', (carlos_id, 'Montura Titanio Kobe APX-01 + Lentes Antirreflejantes Reducidas', 'Gafas', 'En taller / Pedido', 'Graduación: OD -2.25, OI -2.00'))

        cursor.execute('''
            INSERT INTO pedidos (usuario_id, producto, tipo, estado, notas)
            VALUES (?, ?, ?, ?, ?)
        ''', (carlos_id, 'Pack 6 meses Lentillas Diarias Hidrogel de Silicona', 'Lentillas', 'Listo para recoger', 'Caja en estantería central B-12'))

        # Cita de muestra para Carlos
        cursor.execute('''
            INSERT INTO citas (usuario_id, servicio, fecha_cita, hora_cita, estado)
            VALUES (?, ?, ?, ?, ?)
        ''', (carlos_id, 'Revisión y Ajuste de Montura', '2026-11-25', '11:30', 'Confirmada'))

    conn.commit()
    conn.close()
    print("Base de datos SQLite actualizada correctamente con tablas de usuarios, pedidos y citas.")

class OpticaAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
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
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/register':
            self.handle_register()
        elif path == '/api/login':
            self.handle_login()
        elif path == '/api/pedidos/actualizar_estado':
            self.handle_update_order_status()
        elif path == '/api/pedidos/crear':
            self.handle_create_order()
        elif path == '/api/citas/crear':
            self.handle_create_appointment()
        else:
            self._send_json(404, {'ok': False, 'error': 'Ruta de API no encontrada'})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/api/pedidos':
            self.handle_get_orders(query)
        elif path == '/api/citas':
            self.handle_get_appointments(query)
        elif path == '/api/usuarios':
            self.handle_list_users()
        elif path.startswith('/api/'):
            self._send_json(404, {'ok': False, 'error': 'Endpoint no encontrado'})
        else:
            super().do_GET()

    # REGISTRO: Rol forzado siempre a 'cliente'
    def handle_register(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            nombre = (data.get('nombre') or '').strip()
            correo = (data.get('correo') or '').strip().lower()
            contrasena = data.get('contrasena') or ''
            # El usuario SIEMPRE es cliente al registrarse
            rol = 'cliente'

            if not nombre or not correo or not contrasena:
                return self._send_json(400, {'ok': False, 'error': 'Todos los campos son obligatorios.'})

            if len(contrasena) < 6:
                return self._send_json(400, {'ok': False, 'error': 'La contraseña debe tener al menos 6 caracteres.'})

            if not re.match(r"[^@]+@[^@]+\.[^@]+", correo):
                return self._send_json(400, {'ok': False, 'error': 'El correo electrónico no es válido.'})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()

            cursor.execute("SELECT id FROM usuarios WHERE correo = ?", (correo,))
            if cursor.fetchone():
                conn.close()
                return self._send_json(409, {'ok': False, 'error': 'Este correo ya está registrado.'})

            salt = secrets.token_hex(16)
            password_hash = hash_password(contrasena, salt)

            cursor.execute('''
                INSERT INTO usuarios (nombre, correo, contrasena, salt, rol)
                VALUES (?, ?, ?, ?, ?)
            ''', (nombre, correo, password_hash, salt, rol))
            conn.commit()
            user_id = cursor.lastrowid
            conn.close()

            print(f"Nuevo cliente registrado: {nombre} ({correo})")
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
            self._send_json(500, {'ok': False, 'error': f'Error en el registro: {str(e)}'})

    # LOGIN: Devuelve rol ('admin' o 'cliente')
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

            print(f"Inicio de sesión correcto: {nombre} ({email}) - Rol: {rol}")
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
            self._send_json(500, {'ok': False, 'error': f'Error en login: {str(e)}'})

    # OBTENER PEDIDOS (Para cliente o para admin)
    def handle_get_orders(self, query):
        try:
            user_id = query.get('user_id', [None])[0]
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()

            if user_id:
                # Pedidos específicos del cliente
                cursor.execute('''
                    SELECT p.id, p.producto, p.tipo, p.estado, p.notas, p.fecha_pedido, u.nombre, u.correo
                    FROM pedidos p
                    JOIN usuarios u ON p.usuario_id = u.id
                    WHERE p.usuario_id = ?
                    ORDER BY p.id DESC
                ''', (user_id,))
            else:
                # Todos los pedidos (vista Admin)
                cursor.execute('''
                    SELECT p.id, p.producto, p.tipo, p.estado, p.notas, p.fecha_pedido, u.nombre, u.correo, p.usuario_id
                    FROM pedidos p
                    JOIN usuarios u ON p.usuario_id = u.id
                    ORDER BY p.id DESC
                ''')

            rows = cursor.fetchall()
            conn.close()

            pedidos = []
            for r in rows:
                item = {
                    'id': r[0],
                    'producto': r[1],
                    'tipo': r[2],
                    'estado': r[3],
                    'notas': r[4],
                    'fecha_pedido': r[5],
                    'cliente_nombre': r[6],
                    'cliente_correo': r[7]
                }
                if len(r) > 8:
                    item['usuario_id'] = r[8]
                pedidos.append(item)

            self._send_json(200, {'ok': True, 'pedidos': pedidos})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    # ADMIN: ACTUALIZAR ESTADO DEL PEDIDO
    def handle_update_order_status(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            pedido_id = data.get('pedido_id')
            nuevo_estado = data.get('nuevo_estado')

            estados_validos = ['Pendiente', 'En taller / Pedido', 'Listo para recoger', 'Entregado']
            if nuevo_estado not in estados_validos:
                return self._send_json(400, {'ok': False, 'error': 'Estado no válido.'})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute('UPDATE pedidos SET estado = ? WHERE id = ?', (nuevo_estado, pedido_id))
            conn.commit()
            updated = cursor.rowcount
            conn.close()

            if updated == 0:
                return self._send_json(404, {'ok': False, 'error': 'Pedido no encontrado.'})

            print(f"Estado de Pedido #{pedido_id} actualizado a: {nuevo_estado}")
            self._send_json(200, {'ok': True, 'mensaje': f'Estado actualizado a: {nuevo_estado}'})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    # CREAR PEDIDO (Admin asigna a cliente o cliente solicita)
    def handle_create_order(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            usuario_id = data.get('usuario_id')
            producto = (data.get('producto') or '').strip()
            tipo = (data.get('tipo') or 'Gafas').strip()
            estado = (data.get('estado') or 'Pendiente').strip()
            notas = (data.get('notas') or '').strip()

            if not usuario_id or not producto:
                return self._send_json(400, {'ok': False, 'error': 'Faltan datos obligatorios.'})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO pedidos (usuario_id, producto, tipo, estado, notas)
                VALUES (?, ?, ?, ?, ?)
            ''', (usuario_id, producto, tipo, estado, notas))
            conn.commit()
            pedido_id = cursor.lastrowid
            conn.close()

            print(f"Nuevo pedido creado #{pedido_id} para usuario ID {usuario_id}")
            self._send_json(201, {'ok': True, 'pedido_id': pedido_id})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    # OBTENER CITAS ("Fechas de quedada")
    def handle_get_appointments(self, query):
        try:
            user_id = query.get('user_id', [None])[0]
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()

            if user_id:
                cursor.execute('''
                    SELECT c.id, c.servicio, c.fecha_cita, c.hora_cita, c.estado, c.fecha_solicitud, u.nombre, u.correo
                    FROM citas c
                    JOIN usuarios u ON c.usuario_id = u.id
                    WHERE c.usuario_id = ?
                    ORDER BY c.fecha_cita ASC, c.hora_cita ASC
                ''', (user_id,))
            else:
                cursor.execute('''
                    SELECT c.id, c.servicio, c.fecha_cita, c.hora_cita, c.estado, c.fecha_solicitud, u.nombre, u.correo, c.usuario_id
                    FROM citas c
                    JOIN usuarios u ON c.usuario_id = u.id
                    ORDER BY c.fecha_cita ASC, c.hora_cita ASC
                ''')

            rows = cursor.fetchall()
            conn.close()

            citas = [
                {
                    'id': r[0],
                    'servicio': r[1],
                    'fecha_cita': r[2],
                    'hora_cita': r[3],
                    'estado': r[4],
                    'fecha_solicitud': r[5],
                    'cliente_nombre': r[6],
                    'cliente_correo': r[7]
                }
                for r in rows
            ]
            self._send_json(200, {'ok': True, 'citas': citas})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    # CREAR CITA
    def handle_create_appointment(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            usuario_id = data.get('usuario_id')
            servicio = (data.get('servicio') or '').strip()
            fecha = (data.get('fecha_cita') or '').strip()
            hora = (data.get('hora_cita') or '').strip()

            if not usuario_id or not servicio or not fecha or not hora:
                return self._send_json(400, {'ok': False, 'error': 'Todos los campos de la cita son obligatorios.'})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO citas (usuario_id, servicio, fecha_cita, hora_cita, estado)
                VALUES (?, ?, ?, ?, 'Confirmada')
            ''', (usuario_id, servicio, fecha, hora))
            conn.commit()
            cita_id = cursor.lastrowid
            conn.close()

            print(f"Cita #{cita_id} agendada para usuario {usuario_id} el {fecha} a las {hora}")
            self._send_json(201, {'ok': True, 'cita_id': cita_id})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    # LISTA DE USUARIOS (Para que Admin pueda asignar pedidos a clientes)
    def handle_list_users(self):
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT id, nombre, correo, rol, fecha_registro FROM usuarios WHERE rol = 'cliente' ORDER BY nombre ASC")
            rows = cursor.fetchall()
            conn.close()

            clientes = [
                {'id': r[0], 'nombre': r[1], 'correo': r[2], 'rol': r[3], 'fecha_registro': r[4]}
                for r in rows
            ]
            self._send_json(200, {'ok': True, 'clientes': clientes})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

if __name__ == '__main__':
    init_db()
    server = socketserver.TCPServer(("", PORT), OpticaAPIHandler)
    server.allow_reuse_address = True
    print(f"Servidor Clínica Óptica con API SQLite activo en: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
