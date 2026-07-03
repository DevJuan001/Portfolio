export const projects = [
  {
    title: "Tracklinker",
    icon: "projects/tracklinker-logo.svg",
    description: `Tracklinker es una aplicación web de gestión de inventarios que permite administrar productos, categorías, proveedores y órdenes de entrada/salida.
    Incluye autenticación con control de acceso por roles, visualización de estadísticas mediante gráficos interactivos y exportación de reportes en PDF y Excel.`,
    challenge: `Las tiendas y talleres que manejan productos con número de serie suelen depender de Excel, libretas y grupos de WhatsApp: las entradas, ventas y garantías se apuntan a mano, sin saber en tiempo real qué hay en bodega, qué se vendió o qué está en garantía.
      El resultado es siempre el mismo: productos extraviados, ventas registradas tarde, garantías que se pierden entre correos y cero información para tomar decisiones.
      El software del mercado es caro, de escritorio y pensado para empresas grandes, no para un equipo pequeño que necesita orden sin pagar licencia premium.`,
    objective: `Construir un panel web donde el equipo de inventario pueda registrar entradas, ventas y garantías en un solo lugar, con información en tiempo real y reportes descargables, sin procesos manuales ni hojas de cálculo.`,
    objectiveModules: [
      {
        title: "Interfaz para el administrador:",
        items: [
          "Dashboard con indicadores y gráficos de todo el inventario",
          "Gestión de usuarios: crear, editar, activar y desactivar cuentas",
          "Control total sobre productos, categorías, subcategorías y proveedores",
          "Acceso a todos los reportes y exportaciones en PDF y Excel",
        ],
      },
      {
        title: "Interfaz para el equipo de almacén y técnico:",
        items: [
          "Registro de entradas de productos con serial, factura y proveedor",
          "Catálogo de productos, marcas, modelos y categorías",
          "Órdenes de salida (ventas) con cliente y fecha de garantía",
          "Gestión de garantías: crear, asignar técnico y cambiar el estado hasta cerrarla",
          "Reportes filtrados por rango de fechas y descargables",
        ],
      },
    ],
    technicalDecisions: [
      {
        title: `Control de acceso por roles desde el primer día:`,
        explain: `El sistema maneja tres perfiles: Administrador, Almacén y Técnico. Cada uno solo ve y solo puede hacer lo que su rol le permite, y la regla se valida en el servidor en cada petición, así nadie entra a donde no debe por un descuido de la pantalla.`,
      },
      {
        title: `Inicio de sesión con cookies seguras:`,
        explain: `El servidor entrega las credenciales en cookies especiales que el navegador guarda por ti y que ningún JavaScript puede leer. Si la sesión expira, la app la renueva sola sin que tengas que volver a escribir la contraseña.`,
      },
      {
        title: `Correos enviados en segundo plano:`,
        explain: `Cuando se crea un usuario o se recupera una contraseña, el correo se manda en segundo plano con reintentos automáticos. La pantalla nunca se queda esperando y tú puedes seguir trabajando mientras tanto.`,
      },
      {
        title: `Pruebas E2E con BDD:`,
        explain: `Un proyecto aparte de Java con Serenity y Cucumber automatiza los flujos críticos (login, productos, usuarios, categorías, garantías y órdenes) escritos en español casi como si fueran instrucciones para una persona. Garantiza que el sistema funciona de punta a punta, no solo sus piezas por separado.`,
      },
      {
        title: `Reglas de negocio consistentes en el servidor:`,
        explain: `El ciclo de vida del producto (activo, vendido, en garantía) se valida en una sola fuente de verdad en el servidor: nunca se puede crear una garantía de un producto que no se vendió, ni vender dos veces el mismo serial. La app no se rompe aunque alguien la use mal.`,
      },
    ],
    images: [
      "/projects/tracklinker-1.png",
      "/projects/tracklinker-2.png",
      "/projects/tracklinker-3.png",
    ],
    link: "https://tracklinker-frontend-web.vercel.app/",
    github: "https://github.com/DevJuan001/Tracklinker-frontend-web",
    alt: "Proyecto tracklinker",
    stack: ["Python", "FastAPI", "Redis", "React", "Tailwind", "Tanstack"],
  },

  {
    title: "Parking hackathon",
    icon: "projects/parking-logo.svg",
    description: `Aplicación web para digitalizar la operación de un parqueadero,
      el cliente registra su placa al ingresar, la app le asigna una plaza y al salir calcula y cobra automáticamente según la tarifa del tipo de vehículo;
      el operador administra usuarios, plazas, pisos y tarifas desde un panel.`,
    challenge: `Los parqueaderos pequeños y medianos operan con procesos manuales y desconectados: el guardia anota placas en papel, el cajero cobra "a ojo" sin cálculo real del tiempo, las plazas se asignan sin distinguir carro de moto, y el dueño no sabe cuánto entró ni cuánto se cobró al final del día. 
      El software existente es caro, on-premise y no tiene una experiencia pensada para el conductor. Resultado: descuadros, cobros inconsistentes y cero trazabilidad.`,
    objective: `Construir un SaaS multi-tenant donde cualquier parqueadero pueda registrarse solo y operar en minutos, con dos experiencias en un mismo producto:`,
    objectiveModules: [
      {
        title: "Interfaz para el administrador:",
        items: [
          "Dashboard en tiempo real",
          "Configuración de pisos, plazas y tarifas",
          "Gestión de usuarios",
          "Registro de entradas/salidas con KPIs y filtros",
        ],
      },
      {
        title: "Interfaz para el cliente:",
        items: [
          "El conductor digita su placa al entrar",
          "Asignación automática de plaza según tipo de vehículo",
          "Cálculo del cobro por tiempo real y tarifa",
          "Registro de salida, liberación de plaza y cobro sin intervención del guardia",
        ],
      },
    ],
    technicalDecisions: [
      {
        title: `Multi-tenant desde el primer día:`,
        explain: `Un mismo despliegue sirve a varios parqueaderos sin que se mezclen los datos.
          El aislamiento vive en el JWT y se filtra en cada query del backend el frontend ni se entera.
          Es lo que convierte el proyecto en un SaaS real y no en una app de un solo cliente.`,
      },
      {
        title: `Auth basada en cookies httpOnly de extremo a extremo:`,
        explain: `El backend emite los tokens en cookies, el frontend manda credentials: "include" y refresca solo en 401.
          Ninguna parte del sistema toca el JWT en JavaScript, Seguridad por diseño, no por parche.`,
      },
      {
        title: `Emails fuera del request.`,
        explain: `El backend encola los correos en Redis con Celery y responde al usuario de inmediato; el envío va en segundo plano con reintentos automáticos.
          Así el registro o la recuperación de contraseña nunca se sienten lentos.`,
      },
      {
        title: `Pruebas E2E con BDD:`,
        explain: `Un proyecto Java aparte con Serenity + Cucumber y Gherkin en español cubre 8 flujos críticos (login, CRUD de usuarios, pisos, plazas, entradas y check-in del cliente) automatizando el navegador.
          Demuestra que el producto funciona de punta a punta, no solo en unit tests.`,
      },
      {
        title: `Reglas de negocio consistentes en el backend:`,
        explain: `Plazas tipadas por vehículo, tarifas por tipo, redondeo a múltiplo de 50, liberación de plaza al pagar, todo en transacciones del backend.`,
      },
    ],
    link: "https://tracklinker-frontend-web.vercel.app/",
    github: "https://github.com/DevJuan001/parking-hackathon",
    images: [
      "projects/parking-1.png",
      "projects/parking-2.png",
      "projects/parking-3.png",
    ],
    alt: "Proyecto parking",
    stack: ["Python", "FastAPI", "Redis", "React", "Tailwind", "Tanstack"],
  },
];
