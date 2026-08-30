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
        title: "Interfaz para el administrador",
        items: [
          "Dashboard con indicadores y gráficos de todo el inventario",
          "Gestión de usuarios: crear, editar, activar y desactivar cuentas",
          "Control total sobre productos, categorías, subcategorías y proveedores",
          "Acceso a todos los reportes y exportaciones en PDF y Excel",
        ],
      },
      {
        title: "Interfaz para el equipo de almacén y técnico",
        items: [
          "Registro de entradas de productos con serial, factura y proveedor",
          "Catálogo de productos, marcas, modelos y categorías",
          "Órdenes de salida (ventas) con cliente y fecha de garantía",
          "Gestión de garantías: crear, asignar técnico y cambiar el estado hasta cerrarla",
          "Reportes filtrados por rango de fechas y descargables",
        ],
      },
    ],
    features: [
      {
        icon: "monitoring",
        title: "Dashboard en tiempo real",
        description: `Toda la operación en una sola pantalla: cuánto stock hay, qué se movió hoy y qué garantías siguen abiertas.
          En lugar de abrir cinco hojas de cálculo para entender cómo va el negocio, entras y lo ves.`,
      },
      {
        icon: "package_2",
        title: "Inventario por número de serie",
        description: `Cada unidad se registra con su propio serial, no como una cantidad genérica en una fila.
          Eso permite responder la pregunta que Excel nunca pudo: dónde está exactamente ese producto y por qué manos pasó.`,
      },
      {
        icon: "orders",
        title: "Órdenes de entrada y salida",
        description: `Las compras a proveedores y las ventas a clientes quedan registradas como órdenes con su factura, su fecha y su responsable.
          El stock se mueve solo cuando existe un documento que lo respalda, nunca "a mano".`,
      },
      {
        icon: "encrypted",
        title: "Garantías con ciclo de vida completo",
        description: `Una garantía nace desde la venta que la originó, se le asigna un técnico y avanza por estados hasta cerrarse.
          Deja de ser un correo perdido y pasa a ser un caso con historial y responsable.`,
      },
      {
        icon: "bar_chart",
        title: "Reportes con gráficos interactivos",
        description: `Productos, categorías, subcategorías y salidas analizados por período, con gráficos de área y de torta además de la tabla.
          Filtras el rango de fechas y la lectura del negocio se arma sola.`,
      },
      {
        icon: "download",
        title: "Exportación a PDF y Excel",
        description: `Cualquier reporte se descarga listo para enviar a contabilidad o para imprimir en una reunión.
          El PDF sale maquetado y el Excel sale con los datos crudos para que puedas seguir trabajándolos.`,
      },
      {
        icon: "groups",
        title: "Roles y permisos por perfil",
        description: `Administrador, Almacén y Técnico ven una aplicación distinta según lo que les toca hacer.
          Nadie se topa con botones que no le corresponden, y el servidor lo verifica en cada petición.`,
      },
      {
        icon: "search",
        title: "Búsqueda, filtros y scroll infinito",
        description: `Los listados largos se navegan buscando y filtrando, cargando resultados a medida que bajas.
          Aunque el catálogo crezca a miles de productos, la pantalla sigue respondiendo igual de rápido.`,
      },
      {
        icon: "dark_mode",
        title: "Modo claro y oscuro",
        description: `La interfaz se adapta a la preferencia de cada persona y la recuerda entre sesiones.
          Para un equipo que vive dentro del panel toda la jornada, esto deja de ser un capricho estético.`,
      },
    ],
    technicalDecisions: [
      {
        title: `Arquitectura por dominio en las dos puntas`,
        content: `Backend y frontend se organizan por feature (productos, garantías, reportes...) y no por tipo de archivo.
          En la API cada módulo baja por routes → controllers → services → repositories; en el cliente por page → hook → service.
          El beneficio real es de mantenimiento: una funcionalidad se toca en una sola carpeta, y sumar un dominio nuevo no obliga a editar diez archivos compartidos.`,
      },
      {
        title: `SQL parametrizado sin ORM`,
        content: `El acceso a datos se escribe en SQL directo sobre MySQL 8 con sustitución por %s, nunca interpolando strings.
          La decisión es deliberada: los reportes agregados por período son la parte más pesada del producto y con SQL propio controlo exactamente el plan de consulta en vez de pelear con el generador de un ORM.
          El costo asumido es escribir más código; la contrapartida es que ninguna consulta hace algo que yo no haya escrito.`,
      },
      {
        title: `Transacciones con rollback garantizado`,
        content: `Toda escritura sigue el mismo contrato: el servicio abre la conexión, confirma al terminar, revierte ante cualquier excepción y cierra en el finally.
          Una venta que falla a mitad de camino no puede dejar el inventario descontado y la orden sin crear: o pasa todo, o no pasa nada.`,
      },
      {
        title: `Sesión en cookies HttpOnly con refresh de un solo vuelo`,
        content: `Los tokens viajan en cookies HttpOnly, así que ningún JavaScript de la página puede leerlos y un XSS no se lleva la sesión.
          Del lado del cliente, el interceptor comparte una única promesa de refresh entre todas las peticiones que reciben 401 al mismo tiempo.
          Sin eso, una pantalla con seis consultas en paralelo dispara seis refresh simultáneos, invalida su propio token y termina expulsando al usuario.`,
      },
      {
        title: `Autorización verificada en el servidor`,
        content: `Los roles (Administrador, Almacén, Técnico) no se resuelven ocultando botones en la interfaz: un middleware valida el rol contra el token en cada petición.
          Esconder la UI mejora la experiencia, pero la frontera de seguridad está en el servidor, que es el único lugar donde el usuario no puede intervenir.`,
      },
      {
        title: `Correos fuera del ciclo de la petición`,
        content: `Los envíos de bienvenida, recuperación de contraseña y sugerencias se encolan en Redis y los procesa un worker de Celery con reintentos automáticos.
          La respuesta al usuario no queda atada a la latencia de un servidor SMTP, y si el correo falla se reintenta solo en vez de perderse.`,
      },
      {
        title: `Rate limiting y caché sobre Redis`,
        content: `El mismo Redis que actúa de broker sostiene el limitador por IP (login mucho más restrictivo que los listados) y la caché de consultas frecuentes, con invalidación explícita al escribir.
          Una sola pieza de infraestructura resolviendo tres necesidades: menos servicios que operar y menos superficie que puede fallar.`,
      },
      {
        title: `Pruebas de carga con JMeter`,
        content: `Un plan de JMeter ejercita los endpoints críticos bajo concurrencia para medir cómo responde la API cuando varios usuarios trabajan a la vez.
          Sirve para detectar consultas lentas y límites de conexiones antes de que aparezcan en producción, no después.`,
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
    description: `SaaS multi-tenant para digitalizar la operación de un parqueadero: el conductor registra su placa al ingresar, la app le asigna plaza y al salir calcula y cobra según la tarifa de su tipo de vehículo.
      El administrador gestiona pisos, plazas, tarifas, reservas y finanzas desde un panel, y puede operarlo conversando con un asistente de IA en lenguaje natural.`,
    challenge: `Los parqueaderos pequeños y medianos operan con procesos manuales y desconectados: el guardia anota placas en papel, el cajero cobra "a ojo" sin cálculo real del tiempo, las plazas se asignan sin distinguir carro de moto, y el dueño no sabe cuánto entró ni cuánto se cobró al final del día.
      El software existente es caro, on-premise y no tiene una experiencia pensada para el conductor. Resultado: descuadros, cobros inconsistentes y cero trazabilidad.`,
    objective: `Construir un SaaS multi-tenant donde cualquier parqueadero pueda registrarse solo y operar en minutos, con dos experiencias en un mismo producto:`,
    objectiveModules: [
      {
        title: "Interfaz para el administrador",
        items: [
          "Onboarding guiado para dejar el parqueadero operativo desde el registro",
          "Dashboard y panel financiero en tiempo real",
          "Configuración de pisos, plazas y tarifas por tipo de vehículo",
          "Reservas con calendario mensual y diario",
          "Gestión de usuarios y registro de entradas/salidas con KPIs y filtros",
          "Asistente de IA para consultar y operar el parqueadero conversando",
        ],
      },
      {
        title: "Interfaz para el cliente",
        items: [
          "El conductor digita su placa al entrar",
          "Asignación automática de plaza según tipo de vehículo",
          "Cálculo del cobro por tiempo real y tarifa",
          "Registro de salida, liberación de plaza y cobro sin intervención del guardia",
          "Reserva anticipada desde un link público o código QR",
        ],
      },
    ],
    features: [
      {
        icon: "how_to_reg",
        title: "Registro y onboarding guiado",
        description: `Un parqueadero nuevo se da de alta solo y queda operativo en minutos: nombre, ubicación, horarios, pisos y tarifas paso a paso.
          Sin instalaciones ni visitas técnicas, que es justo lo que hace inviable al software tradicional del sector.`,
      },
      {
        icon: "directions_car",
        title: "Check-in por placa",
        description: `El conductor digita su placa en la pantalla de entrada y el sistema le asigna una plaza libre acorde a su tipo de vehículo.
          Se acabó la libreta del guardia: el ingreso queda registrado con hora exacta desde el primer segundo.`,
      },
      {
        icon: "point_of_sale",
        title: "Cobro automático por tiempo",
        description: `Al salir, el sistema calcula el tiempo real de estadía, aplica la tarifa del vehículo y redondea el total a un valor cobrable.
          El monto deja de depender del criterio del cajero y pasa a ser el mismo siempre.`,
      },
      {
        icon: "calendar_month",
        title: "Reservas con calendario",
        description: `Las reservas se crean, editan y eliminan sobre un calendario mensual y diario, con vista de lo que ocurre en cada día.
          El administrador ve la ocupación futura en lugar de enterarse cuando el carro ya está en la puerta.`,
      },
      {
        icon: "qr_code_2",
        title: "Link y código QR para reservar",
        description: `Cada parqueadero tiene un enlace público y un QR que puede pegar en la entrada o compartir por WhatsApp.
          El conductor reserva desde su celular sin instalar nada ni crear una cuenta.`,
      },
      {
        icon: "cognition_2",
        title: "Asistente de IA para administrar",
        description: `El administrador escribe lo que necesita por ejemplo: "cuántas plazas libres hay", "cuánto facturamos hoy" y el asistente consulta o ejecuta la acción sobre el parqueadero real.`,
      },
      {
        icon: "account_balance",
        title: "Panel financiero",
        description: `Ingresos, egresos y balance con gráficos e histórico filtrable por período.
          El dueño responde cuánto entró hoy sin cuadrar nada a mano al cerrar el turno.`,
      },
      {
        icon: "tune",
        title: "Configuración de pisos, plazas y tarifas",
        description: `Cada parqueadero modela su propia realidad: cuántos pisos tiene, cómo se llaman sus plazas, qué vehículo acepta cada una y cuánto cobra por tipo.
          El producto se adapta al negocio en vez de obligar al negocio a adaptarse al producto.`,
      },
      {
        icon: "login",
        title: "Acceso con Google",
        description: `Además del registro tradicional, se puede entrar con una cuenta de Google.
          Una fricción menos en el momento más frágil del producto: el primer ingreso.`,
      },
    ],
    technicalDecisions: [
      {
        title: `Aislamiento multi-tenant a nivel de token`,
        content: `Un mismo despliegue atiende a varios parqueaderos y el identificador de tenant se lee siempre del JWT, jamás del body, la ruta o el query string.
          Como el token está firmado por el servidor, un cliente no puede alterarlo para consultar datos de otro parqueadero aunque manipule la petición.
          Es la diferencia entre un SaaS real y una app monocliente desplegada varias veces.`,
      },
      {
        title: `Asistente de IA con RAG y herramientas tipadas`,
        content: `El chatbot no improvisa, cada consulta recupera contexto del parqueadero desde una base vectorial (Qdrant con embeddings locales) y el modelo solo puede actuar mediante un registro de herramientas con esquema declarado y rol requerido.
          Así las respuestas se apoyan en datos reales del tenant y las acciones pasan por la misma lógica de negocio que el resto de la API, en lugar de dejar que el modelo escriba en la base de datos.`,
      },
      {
        title: `Defensa en profundidad del asistente`,
        content: `Antes de llegar al modelo, un clasificador descarta intentos de inyección de prompt. El prompt del sistema restringe el dominio, las herramientas destructivas exigen una confirmación explícita y el aislamiento por tenant se aplica igual que en el resto del sistema.
          El principio es tratar al modelo como entrada no confiable: es un cliente más de la API, no una puerta trasera con permisos especiales.`,
      },
      {
        title: `Memoria conversacional acotada en Redis`,
        content: `El historial vive por parqueadero y usuario con tope de mensajes y expiración automática, saneando secuencias incompletas de llamadas a herramientas antes de reenviarlas al modelo.
          Sin ese saneo, una conversación cortada a la mitad deja mensajes huérfanos que rompen la siguiente petición; con el tope y el TTL, el costo por consulta se mantiene predecible.`,
      },
      {
        title: `Sesión en cookies HttpOnly de extremo a extremo`,
        content: `El servidor emite los tokens como cookies HttpOnly, el cliente envía las credenciales en cada petición y solo renueva cuando recibe un 401.
          Ninguna parte del sistema manipula el token desde JavaScript: la seguridad es una consecuencia del diseño, no un parche agregado después.`,
      },
      {
        title: `Reglas de negocio dentro de transacciones`,
        content: `Plazas tipadas por vehículo, tarifas por tipo, redondeo del cobro y liberación de la plaza al pagar viven en transacciones del servidor.
          Cobrar y liberar la plaza es una sola operación atómica: no puede existir un estado intermedio donde el conductor pagó pero la plaza sigue ocupada.`,
      },
      {
        title: `Trabajo diferido y límites de uso sobre Redis`,
        content: `Los correos se encolan con Celery y se envían en segundo plano con reintentos, mientras el mismo Redis sostiene el rate limiting por endpoint.
          El registro y la recuperación de contraseña responden de inmediato, y los endpoints sensibles quedan protegidos frente a abuso automatizado.`,
      },
      {
        title: `Pruebas unitarias sobre la capa de utilidades`,
        content: `La suite de pytest cubre las funciones donde un error es silencioso y caro: normalización de placas, redondeo del cobro, manejo de fechas y períodos, y validación de entradas.
          Es deliberado priorizar ahí: son piezas puras, se prueban rápido y son exactamente las que producen descuadres de dinero si fallan.`,
      },
    ],
    link: "https://parking-hackathon-frontend.onrender.com/",
    github: "https://github.com/DevJuan001/parking-hackathon-backend",
    images: [
      "projects/parking-1.png",
      "projects/parking-2.png",
      "projects/parking-3.png",
    ],
    alt: "Proyecto parking",
    stack: ["Python", "FastAPI", "Redis", "React", "Tailwind", "Tanstack"],
  },
];
