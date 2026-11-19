// APEX OPTIQUE - Interactive Core Application Logic

document.addEventListener('DOMContentLoaded', () => {
  initVisionSlider();
  initEyewearCatalog();
  initAppointmentModal();
  initHeroToggle();
  initNavigation();
  initFrameDetailsModal();
});

// 1. VISION SIMULATOR (BEFORE / AFTER COMPARISON)
function initVisionSlider() {
  const container = document.getElementById('vision-slider');
  const clippedLayer = document.getElementById('vision-clipped');
  const handle = document.getElementById('vision-handle');
  if (!container || !clippedLayer || !handle) return;

  let isDragging = false;

  const updatePosition = (clientX) => {
    const rect = container.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    const percentage = (x / rect.width) * 100;

    clippedLayer.style.width = `${percentage}%`;
    handle.style.left = `${percentage}%`;
  };

  // Mouse Events
  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  });

  // Touch Events
  handle.addEventListener('touchstart', (e) => {
    isDragging = true;
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging || !e.touches[0]) return;
    updatePosition(e.touches[0].clientX);
  }, { passive: true });

  // Direct Click anywhere on container
  container.addEventListener('click', (e) => {
    if (e.target.closest('#vision-handle')) return;
    updatePosition(e.clientX);
  });

  // Simulator Presets
  const presetButtons = document.querySelectorAll('.vision-preset-btn');
  const beforeLayer = document.querySelector('.vision-before');

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => {
        b.classList.remove('bg-neutral-900', 'text-white');
        b.classList.add('bg-white', 'text-neutral-700', 'border-neutral-200');
      });
      btn.classList.remove('bg-white', 'text-neutral-700', 'border-neutral-200');
      btn.classList.add('bg-neutral-900', 'text-white');

      const preset = btn.dataset.preset;
      if (!beforeLayer) return;

      if (preset === 'blur') {
        beforeLayer.style.filter = 'blur(6px) contrast(0.85)';
      } else if (preset === 'astigmatism') {
        beforeLayer.style.filter = 'blur(3.5px) drop-shadow(4px 0 2px rgba(0,0,0,0.5)) contrast(0.9)';
      } else if (preset === 'glare') {
        beforeLayer.style.filter = 'blur(2px) brightness(1.25) contrast(1.1)';
      } else {
        beforeLayer.style.filter = 'blur(4px) contrast(0.9)';
      }
    });
  });
}

// 2. EYEWEAR CATALOG & FILTERING
const eyewearData = [
  {
    id: 'apx-01',
    name: 'KOBE TITANIUM',
    code: 'APX-01 / JPN',
    category: 'titanium',
    price: '340 €',
    tag: 'Titanio Grado 5',
    specs: {
      dimensions: '48◽21 145',
      weight: '4.2 gramos',
      material: 'Titanio Beta Japonés de 0.8mm',
      hinge: 'Tornillo con freno de teflón autolubricado',
      origin: 'Fukui, Japón',
      description: 'Silueta panto depurada hasta su mínima expresión estructural. El puente de una sola pieza absorbe las tensiones mecánicas sin deformar la graduación óptica.'
    },
    image: 'assets/eyewear-titanium.jpg'
  },
  {
    id: 'apx-02',
    name: 'BERLIN SLATE',
    code: 'APX-02 / DEU',
    category: 'acetate',
    price: '290 €',
    tag: 'Bio-Acetato 8mm',
    specs: {
      dimensions: '51◽19 148',
      weight: '14.5 gramos',
      material: 'Acetato de celulosa Mazzucchelli pulido a mano',
      hinge: 'Charnela de 5 nudillos con remaches pasantes',
      origin: 'Cadore, Italia',
      description: 'Estructura geométrica inspirada en el brutalismo arquitectónico. Los cantos biselados a 45 grados capturan la luz y estilizan la fisonomía facial.'
    },
    image: 'assets/eyewear-acetate.jpg'
  },
  {
    id: 'apx-03',
    name: 'AERO SOLAR',
    code: 'APX-03 / SOL',
    category: 'sunglasses',
    price: '380 €',
    tag: 'Lentes Minerales Polarizadas',
    specs: {
      dimensions: '53◽18 145',
      weight: '8.1 gramos',
      material: 'Titanio ionizado en grafito mate y cristal Barberini',
      hinge: 'Monobloque elástico integrado en varilla',
      origin: 'Fukui / Milán',
      description: 'Lentes de vidrio mineral templado con tratamiento hidrofóbico y antirreflejo posterior de 8 capas. Calidad óptica sin aberración cromática.'
    },
    image: 'assets/eyewear-sunglasses.jpg'
  },
  {
    id: 'apx-04',
    name: 'ZURICH RIMLESS',
    code: 'APX-04 / SUI',
    category: 'rimless',
    price: '360 €',
    tag: 'Sin Montura (Invisible)',
    specs: {
      dimensions: 'Ajuste milimétrico a medida',
      weight: '2.8 gramos',
      material: 'Titanio puro quirúrgico sin soldaduras',
      hinge: 'Sin tornillos por tensión de torsión',
      origin: 'Suiza',
      description: 'La máxima expresión de ligereza. La lente se convierte en el propio elemento estructural fijado por casquillos de compresión de alta precisión.'
    },
    image: 'assets/hero-eyewear.jpg'
  },
  {
    id: 'apx-05',
    name: 'KYOTO ARCHITECT',
    code: 'APX-05 / JPN',
    category: 'titanium',
    price: '395 €',
    tag: 'Edición Limitada',
    specs: {
      dimensions: '47◽22 145',
      weight: '4.6 gramos',
      material: 'Titanio tratado con acabado anodizado satinado',
      hinge: 'Articulación de micro-precisión láser',
      origin: 'Sabae, Japón',
      description: 'Diseñada para quienes valoran la simetría y el equilibrio espacial. Líneas estrictas con un sutil bisel interior para acomodar lentes de alta graduación.'
    },
    image: 'assets/eyewear-portrait.jpg'
  },
  {
    id: 'apx-06',
    name: 'MILANO AMBER',
    code: 'APX-06 / ITA',
    category: 'acetate',
    price: '310 €',
    tag: 'Acetato Translúcido',
    specs: {
      dimensions: '50◽20 145',
      weight: '12.8 gramos',
      material: 'Acetato de algodón biodegradable ámbar cristalino',
      hinge: 'Alma metálica grabada con patrón geométrico',
      origin: 'Varese, Italia',
      description: 'Transparencia cálida que deja ver el esqueleto interno de refuerzo. Aporta luminosidad a la mirada y calidez visual.'
    },
    image: 'assets/eyewear-acetate.jpg'
  }
];

function initEyewearCatalog() {
  const container = document.getElementById('catalog-grid');
  const filterButtons = document.querySelectorAll('.catalog-filter-btn');
  if (!container) return;

  function render(items) {
    container.innerHTML = items.map(item => `
      <div class="eyewear-card group cursor-pointer flex flex-col justify-between" data-id="${item.id}">
        <div class="p-6 pb-2">
          <div class="flex items-center justify-between mb-3">
            <span class="font-mono text-[11px] text-neutral-400 tracking-wider">${item.code}</span>
            <span class="tag-pill">${item.tag}</span>
          </div>
          <h3 class="font-display font-bold text-xl text-neutral-900 group-hover:text-black tracking-tight">${item.name}</h3>
          <p class="font-mono text-xs text-neutral-500 mt-1">${item.specs.dimensions}</p>
        </div>

        <div class="relative w-full aspect-[4/3] overflow-hidden bg-neutral-50 my-2 px-6 flex items-center justify-center">
          <img src="${item.image}" alt="${item.name}" class="img-zoom w-full h-full object-cover mix-blend-multiply opacity-95 group-hover:opacity-100 transition-opacity">
        </div>

        <div class="p-6 pt-3 border-t border-neutral-100 flex items-center justify-between">
          <span class="font-display font-bold text-lg text-neutral-900">${item.price}</span>
          <button class="view-details-btn inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-neutral-800 hover:text-black group-hover:underline">
            Ficha técnica 
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Attach click listeners to open modal
    container.querySelectorAll('.eyewear-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const item = eyewearData.find(i => i.id === id);
        if (item) openFrameDetailsModal(item);
      });
    });
  }

  render(eyewearData);

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.classList.remove('bg-neutral-900', 'text-white');
        b.classList.add('bg-transparent', 'text-neutral-600');
      });
      btn.classList.remove('bg-transparent', 'text-neutral-600');
      btn.classList.add('bg-neutral-900', 'text-white');

      const filter = btn.dataset.filter;
      if (filter === 'all') {
        render(eyewearData);
      } else {
        const filtered = eyewearData.filter(i => i.category === filter);
        render(filtered);
      }
    });
  });
}

// 3. FRAME DETAILS MODAL
function initFrameDetailsModal() {
  const modal = document.getElementById('frame-modal');
  const closeBtn = document.getElementById('close-frame-modal');
  const bookTryonBtn = document.getElementById('modal-book-tryon');

  if (!modal || !closeBtn) return;

  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  if (bookTryonBtn) {
    bookTryonBtn.addEventListener('click', () => {
      close();
      openAppointmentModal('Prueba y Asesoramiento de Monturas');
    });
  }
}

function openFrameDetailsModal(item) {
  const modal = document.getElementById('frame-modal');
  if (!modal) return;

  document.getElementById('modal-frame-name').textContent = item.name;
  document.getElementById('modal-frame-code').textContent = item.code;
  document.getElementById('modal-frame-price').textContent = item.price;
  document.getElementById('modal-frame-desc').textContent = item.specs.description;
  document.getElementById('modal-frame-material').textContent = item.specs.material;
  document.getElementById('modal-frame-dimensions').textContent = item.specs.dimensions;
  document.getElementById('modal-frame-weight').textContent = item.specs.weight;
  document.getElementById('modal-frame-hinge').textContent = item.specs.hinge;
  document.getElementById('modal-frame-origin').textContent = item.specs.origin;
  document.getElementById('modal-frame-img').src = item.image;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

// 4. HERO TOGGLE (ATELIER ARCHITECTURE VS EYEWEAR CRAFT)
function initHeroToggle() {
  const toggleBtn1 = document.getElementById('hero-view-atelier');
  const toggleBtn2 = document.getElementById('hero-view-frame');
  const heroImg = document.getElementById('hero-frame-image');
  const heroBadge = document.getElementById('hero-caption-badge');

  if (!toggleBtn1 || !toggleBtn2 || !heroImg) return;

  toggleBtn1.addEventListener('click', () => {
    toggleBtn1.classList.add('border-b-2', 'border-neutral-900', 'font-bold', 'text-neutral-900');
    toggleBtn1.classList.remove('text-neutral-400');
    toggleBtn2.classList.remove('border-b-2', 'border-neutral-900', 'font-bold', 'text-neutral-900');
    toggleBtn2.classList.add('text-neutral-400');

    heroImg.src = 'assets/reference.jpg';
    if (heroBadge) heroBadge.textContent = 'ESPACIO ARQUITECTÓNICO · FLAGSHIP ATELIER';
  });

  toggleBtn2.addEventListener('click', () => {
    toggleBtn2.classList.add('border-b-2', 'border-neutral-900', 'font-bold', 'text-neutral-900');
    toggleBtn2.classList.remove('text-neutral-400');
    toggleBtn1.classList.remove('border-b-2', 'border-neutral-900', 'font-bold', 'text-neutral-900');
    toggleBtn1.classList.add('text-neutral-400');

    heroImg.src = 'assets/eyewear-titanium.jpg';
    if (heroBadge) heroBadge.textContent = 'TITANIO BETA JAPONÉS · EDICIÓN LIMITADA';
  });
}

// 5. APPOINTMENT MODAL (RESERVA DE CITA)
function initAppointmentModal() {
  const modal = document.getElementById('booking-modal');
  const openButtons = document.querySelectorAll('.open-booking-modal-btn');
  const closeBtn = document.getElementById('close-booking-modal');
  const bookingForm = document.getElementById('booking-form');
  const confirmationView = document.getElementById('booking-confirmation');

  if (!modal) return;

  const open = (preselectedService = null) => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    if (bookingForm && confirmationView) {
      bookingForm.classList.remove('hidden');
      confirmationView.classList.add('hidden');
    }

    if (preselectedService) {
      const select = document.getElementById('booking-service');
      if (select) select.value = preselectedService;
    }
  };

  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  };

  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const service = btn.dataset.service || null;
      open(service);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // Slot buttons selection
  const slotButtons = document.querySelectorAll('.slot-time-btn');
  slotButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      slotButtons.forEach(b => {
        b.classList.remove('bg-neutral-900', 'text-white');
        b.classList.add('border-neutral-200', 'text-neutral-800');
      });
      btn.classList.remove('border-neutral-200', 'text-neutral-800');
      btn.classList.add('bg-neutral-900', 'text-white');
      document.getElementById('selected-time-input').value = btn.dataset.time;
    });
  });

  // Form submit
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('booking-name').value;
      const service = document.getElementById('booking-service').value;
      const date = document.getElementById('booking-date').value;
      const time = document.getElementById('selected-time-input').value || '11:00';

      document.getElementById('confirm-client-name').textContent = name;
      document.getElementById('confirm-service-name').textContent = service;
      document.getElementById('confirm-datetime').textContent = `${date} a las ${time}h`;

      bookingForm.classList.add('hidden');
      confirmationView.classList.remove('hidden');
    });
  }

  // Close from confirmation
  const confirmCloseBtn = document.getElementById('confirm-close-btn');
  if (confirmCloseBtn) {
    confirmCloseBtn.addEventListener('click', close);
  }
}

function openAppointmentModal(serviceName) {
  const modal = document.getElementById('booking-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';

  const select = document.getElementById('booking-service');
  if (select && serviceName) select.value = serviceName;
}

// 6. NAVIGATION & MOBILE DRAWER
function initNavigation() {
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const closeDrawer = document.getElementById('close-drawer');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('translate-x-full');
    });
  }

  if (closeDrawer && mobileDrawer) {
    closeDrawer.addEventListener('click', () => {
      mobileDrawer.classList.add('translate-x-full');
    });
  }

  // Smooth scroll and active indicator update
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          if (mobileDrawer) mobileDrawer.classList.add('translate-x-full');
          const headerOffset = 80;
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // Highlight active link on scroll
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      const matchingLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        matchingLink?.classList.add('active');
      } else {
        matchingLink?.classList.remove('active');
      }
    });
  });
}
