# Chatbot – Texto final unificado
**Estudio Punto Fusión & Auri Alta Joyería**

---

## 0) Bienvenid@s + filtro inicial (alumnos vs. nuevos)
**Mensaje**  
¡Hola! 👋 Bienvenid@ a **Estudio Punto Fusión & Auri Alta Joyería**.  
Antes de continuar, cuéntame:

**¿Eres alumno(a) del estudio y necesitas hacer cambios en tu horario de clase?**

**Botones sugeridos**  
- **Sí, soy alumno(a)**  
- **No, no soy alumno(a)**  
- **No estoy seguro(a)**

**Si responde “No estoy seguro(a)”**  
No hay problema 😊 Si actualmente pagas mensualidad o asistes a un grupo semanal, elige **“Sí, soy alumno(a)”**. Si vienes por primera vez, elige **“No”**.

---

# A) Submenú para alumnos actuales
**Mensaje**  
Perfecto ✅ Elige la opción que necesitas:

1) **Cancelar mi asistencia a una clase**  
2) **Voy a ausentarme por 2 semanas consecutivas**  
3) **Me voy a ausentar por hasta 2 meses**  
4) **Debo ausentarme por problemas de salud**  
5) **Quiero programar mis horas de taller sin asistencia**  
6) **Quiero programar mi asistencia virtual con el Maestro David**  
7) **Volver al menú principal**

---

## A1) Cancelar mi asistencia a una clase
**Mensaje**  
Recuerda: la cancelación debe hacerse **mínimo 48 horas antes**.  
Puedes **reponer 1 clase por mensualidad**.

**Preguntas**  
- **Fecha de la clase a cancelar:**  
- ¿Quieres revisar agenda para reposición? **(sí/no)**

**Botones sugeridos**  
- **Ver agenda para reposición**  
- **Listo, solo cancelar**

**Etiqueta interna:** `ALUMNOS > CANCELAR_1_CLASE`

---

## A2) Voy a ausentarme por 2 semanas consecutivas
**Mensaje**  
Recuerda: debe hacerse **mínimo 48 horas antes**.  
Solo puedes **reponer 1 clase**; la otra se da como **tomada**.

**Preguntas**  
- **Fecha clase 1:**  
- **Fecha clase 2:**  
- ¿Quieres revisar agenda para reposición? **(sí/no)**

**Botones sugeridos**  
- **Ver agenda para reposición**  
- **Listo, registrar ausencia**

**Etiqueta interna:** `ALUMNOS > AUSENCIA_2_SEMANAS`

---

## A3) Me voy a ausentar por hasta 2 meses
**Mensaje**  
Recuerda: debe hacerse **mínimo 48 horas antes**.  
Para conservar tu cupo debes pagar el **50% de cada mensualidad** durante la ausencia.  
En esta modalidad **no hay reposición de clases**.

**Preguntas**  
- **Fecha de salida:**  
- **Fecha de regreso:**

**Etiqueta interna:** `ALUMNOS > AUSENCIA_HASTA_2_MESES`

---

## A4) Debo ausentarme debido a problemas de salud
**Mensaje**  
Esperamos que te mejores pronto 💛  
Tu cupo queda reservado **sin pago** por hasta **1 mes**.

**Preguntas**  
- **Fecha de incapacidad:**  
- **Fecha esperada de regreso:**

**Etiqueta interna:** `ALUMNOS > AUSENCIA_SALUD`

---

## A5) Quiero programar mis horas de taller sin asistencia
**Mensaje**  
Recuerda: las horas de taller sin asistencia **no son acumulables**.  
¿Quieres ver los horarios disponibles?

**Botones sugeridos**  
- **Ver horarios disponibles**  
- **Volver**

**Etiqueta interna:** `ALUMNOS > TALLER_SIN_ASISTENCIA`

---

## A6) Quiero programar mi asistencia virtual con el Maestro David
**Mensaje**  
Recuerda: las sesiones virtuales **no son acumulables**.  
¿Quieres ver los horarios disponibles?

**Botones sugeridos**  
- **Ver horarios disponibles**  
- **Volver**

**Etiqueta interna:** `ALUMNOS > VIRTUAL_MAESTRO_DAVID`

---

## Mensaje automático de cierre (alumnos)
**Mensaje**  
Gracias 😊 Para registrar el cambio, compártenos:  
**Nombre completo:**  
**Grupo/horario actual:**  
Si aplica, envía **captura del calendario** con el horario elegido.

**Etiqueta interna:** `ALUMNOS > CAPTURA_DATOS`

---

# B) Menú principal (para no alumnos / nuevos)
**Mensaje**  
Perfecto 😊 Elige una opción:

2) **Quiero información de clases de joyería**  
3) **Quiero vivir una experiencia de joyería**  
4) **Estoy cotizando la fabricación de una joya**  
5) **Soy joyer@ o tengo una marca y necesito asesoría para que mi negocio siga creciendo**  
6) **Servicios de producción**  
7) **Venta de herramientas de joyería**  
8) **Compra y venta de oro, plata y platino**  
9) **Venta de piedras preciosas**

---

## 2) Quiero información de clases de joyería
**Mensaje**  
¡Perfecto! Para recomendarte la opción ideal, dime:  
1) ¿Tu nivel? **(cero / básico / intermedio / avanzado)**  
2) ¿Qué horario te sirve? **(días + mañana/tarde)**  
3) ¿Estás interesad@ en uno de nuestros **cursos especializados**? **(sí/no)**

---

### 2.1 Principiantes
**Mensaje**  
¡Qué alegría que quieras empezar! 💛  
En este momento **no tenemos cupos disponibles** para Principiantes.  
Abrimos cupos **por trimestres**, porque trabajamos con **grupos pequeños** para ofrecer una enseñanza de alta calidad.  

¿Quieres que te avisemos apenas se libere un cupo?  
¿Qué jornada prefieres?  
- **Jueves:** 4:00 pm – 8:00 pm  
- **Sábados:** 9:00 am – 1:00 pm

**Botones sugeridos**  
- **Sí, avísenme (Jueves)**  
- **Sí, avísenme (Sábados)**  
- **No por ahora**

**Etiqueta interna:** `CLASES > PRINCIPIANTES > LISTA_ESPERA`

---

### 2.2 Taller asistido
**Mensaje**  
Estos talleres son **ocasionales** y son perfectos si viajas con frecuencia o si tienes un **proyecto específico** en el que necesitas acompañamiento, sin inscribirte a clases regulares.  

✅ Requisito: **nivel avanzado de joyería**.  
**Valor por clase: ₡55.000**.  

¿En qué tipo de proyecto quieres trabajar?  
**(armado / engaste / cera / otro)**  
Si quieres, puedes enviar **fotos de tus trabajos actuales** para orientar mejor la sesión.

**Botones sugeridos**  
- **Reservar clase**  
- **Enviar fotos**  
- **Hablar con un asesor**

**Etiqueta interna:** `CLASES > TALLER_ASISTIDO`

---

### 2.3 Alquiler de taller
**Mensaje**  
Perfecto. El alquiler de taller es **mínimo por 1 hora o fracción**.  
(Ej: si necesitas 1h 30m, se cobran **2 horas**).  

✅ Requisito: **nivel intermedio de joyería**.  
**Valor por hora: ₡5.000**.  

Para confirmar disponibilidad:  
1) ¿Qué proceso vas a realizar? **(fabricación / pulimento / limpieza)**  
2) ¿Cuántas horas necesitas?  
3) ¿Tu nivel de experiencia?

**Botones sugeridos**  
- **Reservar taller**  
- **Consultar disponibilidad**

**Etiqueta interna:** `CLASES > ALQUILER_TALLER`

---

### 2.4 Busco clases personalizadas
**Mensaje**  
Claro. Las clases personalizadas se diseñan según tu objetivo.  
Para revisar tu solicitud, cuéntanos:  
1) ¿Eres joyer@ o has tomado clases antes? **(sí/no)**  
2) ¿Qué nivel consideras que tienes? **(básico/intermedio/avanzado)**  
3) ¿Qué te gustaría lograr y en cuánto tiempo?

Con esta información, **nos pondremos en contacto** para revisar tu caso y proponerte el plan más adecuado.

**Etiqueta interna:** `CLASES > PERSONALIZADAS > REVISION`

---

## 3) Quiero vivir una experiencia de joyería
**Mensaje**  
¡Qué buen plan! ✨ Durante la experiencia, con la guía del maestro joyero, podrás fabricar **un anillo sencillo o un dije**.  

👥 El grupo es de **máximo 4 personas**.  
¿Quieres también la opción de **regalar un bono**?

**Botones sugeridos**  
- **Quiero regalar un bono**  
- **Continuar**

**Etiqueta interna:** `EXPERIENCIAS > INFO_GENERAL`

---

### 3.1 Únete a un grupo de clase
**Mensaje**  
Te unes a una sesión grupal guiada (ideal para aprender y compartir).  
**Horarios disponibles:**  
- **Viernes:** 9:00 am – 1:00 pm  
- **Sábado:** 9:00 am – 1:00 pm  

¿Qué horario prefieres?

**Botones sugeridos**  
- **Conocer precios**  
- **Reservar**  
- **Hacer una pregunta**

**Etiqueta interna:** `EXPERIENCIAS > GRUPO`

---

### 3.2 Joyero por un día (4 horas)
**Mensaje**  
Esta experiencia es perfecta para compartir con amigos o con tu pareja 💛  
Ideal para cumpleaños, aniversarios o simplemente un plan especial.  

👥 **Mínimo 2 personas / máximo 4 personas**.  
**Horarios disponibles:**  
- **Jueves:** 9:00 am – 1:00 pm  
- **Sábado:** 3:00 pm – 7:00 pm  

¿Qué horario te gustaría?

**Botones sugeridos**  
- **Conocer precios**  
- **Reservar**  
- **Quiero regalar un bono**

**Etiqueta interna:** `EXPERIENCIAS > JOYERO_4H`

---

### 3.3 Fabricando Historias – Compromiso y bodas
**Mensaje**  
**Fabricando Historias** es una experiencia única en donde las personas participan de la fabricación de su **anillo de compromiso** o **anillos de boda** guiados siempre por un **maestro joyero**.  
Es un momento íntimo, significativo y lleno de historia.  

Si quieres, déjanos tus datos y **te contactamos** para explicarte opciones, tiempos y cómo reservar.

**Botones sugeridos**  
- **Quiero que me contacten**  
- **Reservar**  
- **Hacer una pregunta**

**Etiqueta interna:** `EXPERIENCIAS > FABRICANDO_HISTORIAS > CONTACTO`

---

## 4) Estoy cotizando la fabricación de una joya
**Mensaje**  
Con gusto. Para cotizar de forma clara necesito:  
1) Tipo de joya  
2) Metal (o preferencia)  
3) Presupuesto aproximado (si lo tienes)  
4) Fecha en que la necesitas  
Si tienes foto de referencia, envíala aquí.  

Un/a ejecutivo/a **te estará contactando** para continuar con tu solicitud.

**Etiqueta interna:** `COTIZACION > GENERAL`

---

### 4.1 Información de anillos de compromiso y de bodas
**Mensaje**  
Para anillos/argollas, cuéntame:  
1) ¿Talla? (si no la sabes, te explico cómo medirla)  
2) ¿Con piedra o sin piedra?  
3) ¿Estilo? **(clásico / moderno / minimal / vintage)**  
4) ¿Fecha del compromiso o boda?  

Si tienes una foto de un modelo que te inspire, puedes enviarla aquí.  
Un/a ejecutivo/a **te contactará** para seguir el proceso.

**Etiqueta interna:** `COTIZACION > ANILLOS_BODAS`

---

### 4.2 Otras joyas
**Mensaje**  
Perfecto. Para cotizar necesito:  
1) ¿Qué pieza es? **(aretes/dije/cadena/pulsera/otro)**  
2) ¿En qué metal la deseas? **(oro/plata/platino/otro/no sé)**  
3) ¿Tienes un presupuesto aproximado? **(sí/no — cuál)**  
4) ¿Para cuándo la necesitas?  

Si tienes una foto de un modelo que te inspire, puedes enviarla aquí.  
Un/a ejecutivo/a te contactará para seguir el proceso.

**Etiqueta interna:** `COTIZACION > OTRAS_JOYAS`

---

## 5) Soy joyer@ o tengo una marca y necesito asesoría para que mi negocio siga creciendo
**Mensaje**  
Excelente. Para ayudarte con precisión, elige qué necesitas resolver primero:  
1) **Quiero producir joyería de mejor calidad**  
2) **Necesito ayuda para establecer los precios de venta de mis joyas**  
3) **Necesito estandarizar mis procesos de producción**  
4) **Necesito asesoría para comprar máquinas y/o herramienta especializada para mejorar mi producción**  
5) **Quiero que me asesoren para crear una marca o línea de joyería premium**  

Responde con el número y cuéntame tu etapa: **(empezando / vendiendo / escalando)**

**Etiqueta interna:** `ASESORIA > MARCAS`

---

## 6) Servicios de producción
### Filtro previo
**Mensaje**  
Antes de continuar, cuéntanos: ¿Eres joyer@?

**Botones sugeridos**  
- **Sí, soy joyer@ (compartir Instagram)**  
- **No, no soy joyer@**

**Si responde “Sí, soy joyer@”**  
Perfecto 😊 Comparte por favor el Instagram de tu marca (link o @usuario) para abrir tu solicitud.

**Etiqueta interna:** `PRODUCCION > FILTRO_JOYERO`

---

### 6.1 Baños de oro
**Mensaje**  
Claro. Este servicio lo realizamos **únicamente** en joyas de **oro, plata o bronce**.  
Para cotizar necesitamos:  
1) ¿Qué es la pieza? (anillo/cadena/aretes/otro)  
2) ¿Material base? **(oro, plata o bronce)**  
3) ¿Color del baño? (amarillo/rosa/blanco)  
4) ¿Cuántas piezas son?  
📸 Si puedes, envía 2–3 fotos (frente y detalle).

**Botones sugeridos**  
- **Enviar fotos**  
- **Solicitar cotización**  
- **Quiero que me contacten**

**Etiqueta interna:** `PRODUCCION > BANOS_ORO`

---

### 6.2 Casting, vaciado o fundición
**Mensaje**  
Perfecto. Este servicio se realiza en **oro y en plata**.  
Para cotizar necesitamos:  
1) ¿Ya tienes el modelo? (cera/archivo 3D/no)  
2) ¿En qué metal lo necesitas? **(oro/plata)**  
3) ¿Cuántas piezas?  
4) ¿Para cuándo lo necesitas?  
Si tienes fotos del modelo o archivo, puedes enviarlos.

**Botones sugeridos**  
- **Solicitar cotización**  
- **Enviar archivo/fotos**  
- **Quiero que me contacten**

**Etiqueta interna:** `PRODUCCION > CASTING_FUNDICION`

---

### 6.3 Producción de materiales
**Mensaje**  
Claro. Fabricamos materiales en **oro y en plata**.  
Para cotizar cuéntanos:  
1) ¿Qué necesitas? (lámina/hilo/soldadura/otro)  
2) ¿Metal? **(oro/plata)**  
3) ¿Medidas? (ej: calibre, ancho, largo)  
4) ¿Cantidad aproximada?  
5) ¿Fecha en que lo necesitas?

**Botones sugeridos**  
- **Solicitar cotización**  
- **Hablar con un asesor**

**Etiqueta interna:** `PRODUCCION > MATERIALES`

---

### 6.4 Arreglos en joyas
**Mensaje**  
Con gusto. Realizamos arreglos **únicamente** en joyas de **oro, plata y platino**.  
Para orientarte mejor, cuéntanos:  
1) **¿Qué daño tiene tu joya?** (cadena rota/talla/piedra floja/cierre/rayones/otro)  
2) ¿De qué metal es? **(oro / plata / platino)**  
3) ¿Tu joya es de una marca comercial? (ej: Pandora, Tiffany…) **(sí/no — cuál)**  
4) ¿Para cuándo la necesitas?  
5) 📸 Envía una foto o video corto mostrando el daño.  
*La cotización final se confirma al revisar la pieza en físico.*

**Botones sugeridos**  
- **Enviar foto/video**  
- **Agendar revisión**  
- **Quiero que me contacten**

**Etiqueta interna:** `PRODUCCION > ARREGLOS`

---

### 6.5 Valoración de joyas
**Mensaje**  
Perfecto. La valoración te da un **valor referencial de mercado** según materiales, estado y características. *(No es oferta de compra).*  
Para orientarte, dinos el objetivo:  
**venta / herencia / compra informada**  

Y envía 3 fotos:  
1) Frente de la pieza  
2) Contramarcas/sellos (si tiene)  
3) Detalle de la piedra (de cerca)

**Botones sugeridos**  
- **Quiero valoración (venta)**  
- **Quiero valoración (herencia)**  
- **Quiero valoración (compra informada)**  
- **Enviar fotos**  
- **Agendar revisión**

**Etiqueta interna:** `PRODUCCION > VALORACION`

---

## 7) Venta de herramientas de joyería
**Mensaje**  
Para ver nuestro catálogo, visita nuestra tienda virtual: **www.tiendapuntofusion.com**  

Si estás buscando una **herramienta especializada** y quieres que te orientemos, cuéntanos:  
1) ¿Qué proceso haces? (soldadura/pulido/engaste/cera/otro)  
2) ¿Qué equipo/herramienta tienes hoy? (si aplica)  
3) ¿Presupuesto aproximado?

**Botones sugeridos**  
- **Ir a la tienda virtual**  
- **Asesoría herramienta especializada**  
- **Cotizar**

**Etiqueta interna:** `VENTAS > HERRAMIENTAS`

---

## 8) Compra y venta de oro, plata y platino
**Mensaje**  
Te orientamos con el proceso. Para comenzar:  
1) ¿Es **compra** o **venta**?  
2) ¿Qué metal? (oro/plata/platino)  
3) ¿En qué formato? (joya/chatarra/moneda/lingote)  
4) ¿Cantidad aproximada y ciudad?  
*El valor final se confirma al verificar el material.*

**Botones sugeridos**  
- **Quiero vender**  
- **Quiero comprar**  
- **Agendar revisión/verificación**

**Etiqueta interna:** `METALES > COMPRA_VENTA`

---

## 9) Venta de piedras preciosas
**Mensaje**  
Perfecto. Para recomendarte opciones:  
1) ¿Qué piedra buscas? (diamante/zafiro/esmeralda/moissanita/otra)  
2) ¿Natural o laboratorio?  
3) ¿Medida o presupuesto aproximado?  
4) ¿La necesitas con certificado? (sí/no)

**Botones sugeridos**  
- **Ver opciones**  
- **Quiero asesoría**  
- **Cotizar piedra**

**Etiqueta interna:** `VENTAS > PIEDRAS`

---

# Mensajes automáticos (para capturar datos y crear tareas internas)

## A) Datos básicos (para cualquier solicitud)
**Mensaje**  
Súper. Para continuar, compártenos:  
**Nombre:**  
**WhatsApp:**  
**Ciudad:**  
**País:**  
¿Cómo prefieres seguir? **(mensaje / llamada / visita al estudio)**

**Etiqueta interna:** `DATOS > CAPTURA`

---

## B) Reservas (clase / taller / experiencia)
**Mensaje**  
Perfecto. Para reservar, por favor:  
1) Revisa los **horarios disponibles en nuestro calendario** y elige tu espacio.  
2) Realiza el pago por **SINPE**.  
3) Envía **foto del comprobante** por este medio para dejar tu reserva confirmada.  

*Los valores pagados no son reembolsables.*

**Botones sugeridos**  
- **Ver calendario**  
- **Enviar comprobante SINPE**  
- **Necesito ayuda para reservar**

**Etiqueta interna:** `RESERVA > PAGO_SINPE`

---

## C) Cotizaciones (producción / joya a medida)
**Mensaje**  
Gracias. Con esta información abrimos tu solicitud.  
Un/a ejecutivo/a te contactará para confirmar detalles, tiempos y entrega.  
Si tienes referencias (fotos/medidas), envíalas por aquí para agilizar.

**Etiqueta interna:** `COTIZACION > EN_PROCESO`

---

## Campos internos recomendados (para tu equipo)
- `SERVICIO` (Alumnos / Clases / Experiencias / Cotización / Producción / Ventas)  
- `SUBSERVICIO` (Cancelar/Ausencia/Baños/Casting/Materiales/Arreglos/Valoración/etc.)  
- `OBJETIVO` (venta/herencia/compra informada/…)  
- `NIVEL` (si aplica)  
- `FECHA/HORARIO`  
- `FOTOS/ARCHIVOS` (sí/no)  
- `ESTADO` (nuevo / en espera / agendado / cotizado / cerrado)

