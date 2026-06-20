export const projects = [
  {
    title: "Tracklinker",
    description: `Tracklinker es una aplicación web de gestión de inventarios que permite administrar productos, categorías, proveedores y órdenes de entrada/salida.
    Incluye autenticación con control de acceso por roles, visualización de estadísticas mediante gráficos interactivos y exportación de reportes en PDF y Excel.`,
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
    title: "Sistema de gestión de parqueaderos",

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
      "/projects/parking-1.png",
      "/projects/parking-2.png",
      "/projects/parking-3.png",
    ],

    alt: "Proyecto parking",

    stack: ["Python", "FastAPI", "Redis", "React", "Tailwind", "Tanstack"],
  },
];
