# Plan Maestro de Automatización por Canal

## Objetivo del documento

Este documento define, canal por canal, qué cosas tiene sentido automatizar dentro de esta app, qué objetos deberían existir en el backend, qué secciones debe mostrar el frontend para cada canal y qué métricas deben verse en el dashboard.

La idea no es tratar todos los canales igual. Cada canal tiene naturaleza distinta:

- `Instagram` vive de piezas visuales, stories, reels, DMs y resultados por media.
- `TikTok` vive de videos, comentarios, performance por pieza y leads de tráfico.
- `Email` vive de entregabilidad, aperturas, clics, replies y secuencias.
- `WhatsApp` vive de conversaciones, templates, handoff y tiempos de respuesta.
- `Facebook` mezcla publicación, comentarios, DMs y leads.
- `X` mezcla posts, menciones, replies, threads y DMs.
- `Messenger` vive de conversaciones y handoff.
- `Automations` no es un canal externo; es la capa interna que orquesta procesos.
- `Phone / Voice` ya existe aparte del módulo de channels y debe verse como un workspace operativo propio.

Por eso el frontend no debería repetir las mismas gráficas y las mismas secciones en todos los canales. El sistema debe mantener una base común, pero cada canal necesita su propia vista de operación.

---

## Modelo común para todos los canales

Aunque cada canal tenga pantallas distintas, todos deberían compartir una base operativa:

- `Account`
  - La cuenta conectada del canal.
  - Ejemplo: un perfil de Instagram, una bandeja de WhatsApp, un remitente de email.

- `Agent`
  - La personalidad operativa del canal.
  - Ejemplo: un bot de replies, un redactor de copies, un clasificador de leads.

- `Flow`
  - La lógica reusable.
  - Ejemplo: "responder comentario", "publicar pieza", "capturar lead", "enviar secuencia".

- `Job`
  - La ejecución concreta.
  - Ejemplo: un reel publicado, un email enviado, un comentario respondido, un template mandado.

- `Events`
  - El log de qué pasó en cada job.
  - Ejemplo: queued, running, completed, failed, requires_auth.

### Secciones comunes mínimas del dashboard

Todos los canales deberían tener una base común:

1. Resumen del canal
2. Cuentas conectadas
3. Agentes del canal
4. Flows activos
5. Jobs recientes
6. Estado operativo
7. Errores y bloqueos

Pero además, cada canal debe tener secciones específicas.

---

## 1. Automations

### Qué es en esta app

`Automations` no es un canal social. Es la capa interna que dispara y coordina procesos entre módulos.

### Qué automatizar aquí

- Ejecutar workflows internos
- Rutear leads a colas o usuarios
- Actualizar CRM
- Mover estados de pipeline
- Disparar jobs en otros canales
- Reintentar procesos fallidos
- Encadenar acciones multi-canal

### Secciones específicas del dashboard

- `Workflows ejecutados`
  - Cuántos workflows corrieron
  - Cuántos completaron
  - Cuántos fallaron

- `Leads ruteados`
  - Leads enviados por owner, equipo o cola
  - Tiempo promedio de asignación

- `CRM updates`
  - Registros creados
  - Registros actualizados
  - Cambios de etapa

- `Dependencias externas`
  - Qué workflows dependen de email, voz, WhatsApp, etc.

### KPIs que sí tienen sentido

- Workflows completados
- Error rate por workflow
- Tiempo promedio de ejecución
- Leads ruteados por fuente
- Tareas reintentadas
- Automatizaciones activas vs pausadas

### Jobs específicos

- `workflow_run`
- `lead_routing`
- `crm_update`

### Fase 1 recomendada

- Historial de workflows
- Estado por automation
- KPI de errores y reintentos

### Fase 2 recomendada

- Dependencias entre workflows
- Timeline de ejecuciones
- Árbol visual de fallos y downstream impact

---

## 2. Email

### Naturaleza del canal

Email no se mide como red social. Se mide por entrega, apertura, clic, reply y secuencia.

### Qué automatizar

- Envío de email único
- Secuencias multistep
- Etiquetado/segmentación de contactos
- Warm follow-up
- Recontacto automático
- Respuesta sugerida a replies
- Clasificación automática de respuestas
- Escalado a humano si la respuesta requiere atención

### Secciones específicas del dashboard

- `Emails enviados`
  - Volumen por día, campaña y agente

- `Secuencias activas`
  - Qué secuencias están corriendo
  - Cuántos contactos hay en cada paso

- `Entregabilidad`
  - Sent
  - Delivered
  - Bounced
  - Deferred
  - Complaints

- `Engagement`
  - Open rate
  - Click rate
  - Reply rate
  - Unsubscribe rate

- `Replies recibidas`
  - Respuestas clasificadas
  - Interés
  - Objeción
  - Out of office
  - No interesado

- `Contactos etiquetados`
  - Qué tags se aplicaron
  - Cuántos contactos entraron a cada segmento

### KPIs que sí tienen sentido

- Emails enviados
- Delivery rate
- Bounce rate
- Open rate
- Click rate
- Reply rate
- Contacts tagged
- Sequences running

### Jobs específicos

- `send_email`
- `send_sequence`
- `tag_contact`

### Gráficas ideales

- Donut de entregabilidad
- Donut de replies por categoría
- Funnel de sequence step progression
- Barra de volumen enviado por día

### Fase 1 recomendada

- Dashboard de entregabilidad y replies
- Tabla de secuencias activas
- Historial de jobs

### Fase 2 recomendada

- Recomendaciones automáticas de follow-up
- Priorización de replies por intención
- Score de calidad por secuencia

---

## 3. Facebook

### Naturaleza del canal

Facebook es híbrido: publicaciones, comentarios, DMs y captación de leads.

### Qué automatizar

- Publicar posts de feed
- Responder comentarios
- Responder DMs
- Capturar leads desde interacción
- Derivar conversaciones a humano
- Reusar contenido evergreen
- Detectar comentarios con intención comercial

### Secciones específicas del dashboard

- `Posts publicados`
  - Lista de posts publicados
  - Estado
  - Fecha
  - Resultado

- `Comentarios contestados`
  - Volumen respondido
  - Tiempo medio de respuesta
  - Comentarios sin atender

- `DMs contestados`
  - Conversaciones resueltas
  - Conversaciones abiertas
  - Handoff a humano

- `Leads capturados`
  - Leads originados desde comentario
  - Leads originados desde DM
  - Leads con seguimiento

- `Rendimiento del contenido`
  - Posts con más interacción
  - Tasa de comentario a lead

### KPIs que sí tienen sentido

- Posts publicados
- Comentarios respondidos
- DMs respondidos
- Leads capturados
- Tiempo promedio de respuesta
- Conversaciones escaladas

### Jobs específicos

- `publish_post`
- `reply_comment`
- `reply_dm`
- `capture_lead`

### Gráficas ideales

- Donut de tipo de job ejecutado
- Donut de origen de lead
- Barra de posts por semana
- Barra de comentarios respondidos por día

### Fase 1 recomendada

- Feed de posts
- Cola de comentarios
- Inbox simplificado
- Leads capturados

### Fase 2 recomendada

- Priorización de comentarios por intención
- Clasificación automática de DMs
- Scoring de conversación comercial

---

## 4. Instagram

### Naturaleza del canal

Instagram es visual primero. No debe verse como “mensajes y ya”. Debe tener un workspace claro de piezas publicadas y resultados por tipo de media.

### Qué automatizar

- Publicar foto
- Publicar carrusel
- Publicar story
- Publicar reel
- Responder DMs
- Clasificar DMs entrantes
- Reusar assets creativos
- Detectar piezas con mejor performance

### Secciones específicas del dashboard

#### A. Imágenes subidas

Esta sección debe existir sí o sí.

Debe mostrar:

- Fotos subidas
- Carruseles subidos
- Borradores listos para publicar
- Estado por asset
- Fecha de publicación
- Agent o flow que la generó

#### B. Resultado por imagen

También debe existir sí o sí.

Cada imagen publicada debería tener:

- Alcance
- Guardados
- Shares
- Likes
- Comentarios
- CTR si hay CTA rastreable
- Leads atribuidos

#### C. Stories publicadas

- Stories subidas
- Stories con mejor retención
- Stories con más taps
- Stories que generaron reply o DM

#### D. Reels publicados

- Reels subidos
- Plays
- Completion rate
- Shares
- Saves
- Comentarios

#### E. DMs contestados

- Conversaciones respondidas
- Conversations waiting
- Tiempo promedio de primera respuesta
- Handoff a humano

### KPIs que sí tienen sentido

- Imágenes publicadas
- Stories publicadas
- Reels publicados
- DMs respondidos
- Saves por pieza
- Shares por pieza
- Leads por asset
- Conversion rate por formato

### Jobs específicos

- `publish_post`
- `publish_story`
- `publish_reel`
- `reply_dm`

### Gráficas ideales

- Donut por tipo de contenido
  - feed
  - story
  - reel

- Donut de estado de piezas
  - draft
  - scheduled
  - published
  - failed

- Barra de top imágenes por leads
- Barra de top reels por reproducciones
- Ring de response rate en DMs

### Fase 1 recomendada

- Sección de `Imágenes subidas`
- Sección de `Reels publicados`
- Sección de `DMs contestados`
- Tabla de resultados por pieza

### Fase 2 recomendada

- Librería de media reusable
- Clasificación automática de DMs por intención
- Scoring de performance por asset
- Recomendación de mejor formato por campaña

---

## 5. X

### Naturaleza del canal

X es texto, velocidad y conversación pública. Aquí importan posts, replies, mentions y DMs.

### Qué automatizar

- Publicar posts
- Publicar threads
- Responder menciones
- Responder replies
- Enviar DMs
- Escalar conversaciones críticas
- Detectar palabras clave
- Capturar leads desde mention o DM

### Secciones específicas del dashboard

- `Posts publicados`
  - Posts simples
  - Threads
  - Estado de publicación

- `Menciones contestadas`
  - Cuántas menciones se respondieron
  - Cuáles siguen pendientes

- `DMs enviados`
  - Outreach iniciado
  - Follow-up enviado
  - Conversaciones abiertas

- `Engagement por post`
  - Replies
  - Likes
  - Reposts
  - Bookmarks
  - Clicks

- `Conversaciones comerciales`
  - Usuarios con intención
  - Casos escalados
  - Leads originados

### KPIs que sí tienen sentido

- Posts publicados
- Mentions replied
- DMs enviados
- Leads desde X
- Thread completion
- Tiempo de respuesta a mention

### Jobs específicos

- `publish_post`
- `reply_mention`
- `send_dm`

### Gráficas ideales

- Donut de mix entre posts, mentions y DMs
- Donut de estado de conversación
- Barra de top posts por interacción
- Barra de mentions respondidas por día

### Fase 1 recomendada

- Feed de posts
- Inbox/cola de mentions
- Registro de DMs

### Fase 2 recomendada

- Sugerencia de replies según contexto
- Agrupado por thread
- Priorización de cuentas con alto potencial

---

## 6. TikTok

### Naturaleza del canal

TikTok es video primero. No debe verse como si fuera solo “publicar contenido”. La app debería mostrar claramente el inventario de videos y el rendimiento de cada uno.

### Qué automatizar

- Subir videos
- Responder comentarios
- Capturar leads desde tráfico o CTA
- Clasificar comentarios
- Priorizar videos con mejor performance
- Reutilizar guiones
- Detectar piezas que requieren follow-up comercial

### Secciones específicas del dashboard

#### A. Videos subidos

Esta sección debe existir sí o sí.

Debe mostrar:

- Videos subidos
- Borradores
- Videos publicados
- Fecha de subida/publicación
- Flow que los creó
- Agent responsable

#### B. Resultado por video

Cada video debería tener:

- Reproducciones
- Completion rate
- Likes
- Shares
- Guardados
- Comentarios
- CTR de bio/link si aplica
- Leads atribuidos

#### C. Comentarios contestados

- Comentarios respondidos
- Comentarios pendientes
- Tiempo promedio de respuesta
- Comentarios con intención de compra

#### D. Mensajes contestados

Aunque no sea el foco principal del catálogo actual, conviene dejar esta sección prevista como evolución.

Debe mostrar:

- Conversaciones abiertas
- Conversaciones atendidas
- Handoff a humano
- Leads creados desde conversación

#### E. Tráfico y lead capture

- Leads por video
- Videos que más convierten
- Videos con más comentarios comerciales

### KPIs que sí tienen sentido

- Videos publicados
- Videos con alto completion
- Comentarios contestados
- Leads por video
- Videos top por engagement
- Tasa comentario -> lead

### Jobs específicos

- `publish_video`
- `reply_comment`
- `capture_lead`

### Gráficas ideales

- Donut de estado de videos
  - draft
  - queued
  - published
  - failed

- Donut de resultado por tipo de interacción
  - views
  - comments
  - shares
  - leads

- Barra de top videos por leads
- Barra de top videos por retención
- Ring de comentarios respondidos

### Fase 1 recomendada

- `Videos subidos`
- `Resultado por video`
- `Comentarios contestados`
- `Leads capturados`

### Fase 2 recomendada

- `Mensajes contestados`
- Score de contenido por intención comercial
- Prioridad automática de reply

---

## 7. WhatsApp

### Naturaleza del canal

WhatsApp es conversación y soporte comercial. Lo más importante no es “posts”, sino inbox, templates, escalado y tiempos de respuesta.

### Qué automatizar

- Enviar templates
- Responder mensajes
- Clasificar conversaciones
- Handoff a humano
- Detectar intención comercial
- Reactivar leads fríos
- Confirmar citas
- Cobranza y seguimiento

### Secciones específicas del dashboard

- `Templates enviados`
  - Volumen por template
  - Aprobados
  - Fallidos
  - Entregados

- `Conversaciones activas`
  - Abiertas
  - Esperando respuesta
  - Resueltas
  - Handoff a humano

- `Mensajes contestados`
  - Volumen por día
  - First response time
  - Average handling time

- `Leads y oportunidades`
  - Leads nuevos
  - Leads retomados
  - Conversaciones que se volvieron oportunidad

- `Plantillas con mejor resultado`
  - Qué template generó más reply
  - Qué template generó más conversión

### KPIs que sí tienen sentido

- Templates enviados
- Delivery rate
- Reply rate
- Handoff rate
- Tiempo de primera respuesta
- Conversaciones resueltas
- Leads generados

### Jobs específicos

- `send_template`
- `reply_message`
- `handoff_agent`

### Gráficas ideales

- Donut de estado de conversación
- Donut de tipos de template
- Barra de templates por reply rate
- Barra de leads por día

### Fase 1 recomendada

- Inbox operativo
- Historial de templates
- Handoff básico
- KPI de reply rate

### Fase 2 recomendada

- Clasificación automática por intención
- SLA por agente
- Priorización de chats calientes

---

## 8. Messenger

### Naturaleza del canal

Messenger es parecido a WhatsApp en estructura conversacional, pero nace más de interacciones con ecosistema Meta.

### Qué automatizar

- Enviar mensajes
- Responder comentarios vinculados
- Handoff a humano
- Clasificar conversaciones
- Capturar lead desde chat
- Retomar conversaciones abandonadas

### Secciones específicas del dashboard

- `Conversaciones activas`
- `Mensajes enviados`
- `Comentarios vinculados contestados`
- `Handoff a humano`
- `Leads capturados desde chat`

### KPIs que sí tienen sentido

- Messages sent
- Conversations active
- Comment replies
- Handoff count
- Leads captured
- First response time

### Jobs específicos

- `send_message`
- `reply_comment`
- `handoff_agent`

### Gráficas ideales

- Donut de estado de conversación
- Donut de tipo de job
- Barra de mensajes enviados por día
- Barra de handoffs por semana

### Fase 1 recomendada

- Inbox
- Historial de jobs
- Handoff
- Leads desde conversación

### Fase 2 recomendada

- Clasificación por intención
- Score de urgencia
- Cola de conversaciones priorizadas

---

## 9. Phone / Voice

### Naturaleza del canal

Aunque hoy esté fuera del módulo `channels`, operativamente ya es un canal completo dentro del producto.

### Qué automatizar

- Llamadas de confirmación
- Llamadas de cobranza
- Recontacto
- Realtime voice AI
- IVR simple
- Handoff posterior a humano
- Clasificación por outcome

### Secciones específicas del dashboard

- `Agentes de voz`
- `Flows de voz`
- `Call jobs`
- `Outcomes`
- `Transcript / resumen`
- `Realtime sessions`
- `Errores de carrier y webhook`

### KPIs que sí tienen sentido

- Calls attempted
- Calls completed
- Busy / failed / no-answer
- Confirmed
- Callback
- Not interested
- Tiempo promedio de llamada

### Gráficas ideales

- Donut de estado de llamada
- Donut de outcome
- Embudo de intentos -> completadas -> confirmadas
- Ring de conectividad / entrega / conversión / cobertura

### Fase 1 recomendada

- Lo que ya existe
- Mejor transcript
- Mejor cierre de outcome

### Fase 2 recomendada

- Analytics por agent
- Analytics por flow
- A/B de guiones
- Call quality score

---

## Estructura de frontend recomendada por canal

El frontend debería dejar de pensar en un resumen genérico idéntico para todo.

### Estructura recomendada

1. `Hero del canal`
   - estado
   - cuenta(s) conectadas
   - CTA principal

2. `KPIs core`
   - 4 métricas máximas
   - no repetir significado

3. `Visualización de mezcla`
   - donut de tipo de asset, estado o resultado

4. `Embudo o rendimiento`
   - barras si hay secuencia
   - no usar barras para todo

5. `Sección específica del canal`
   - ejemplo:
     - Instagram: imágenes subidas
     - TikTok: videos subidos
     - Email: secuencias activas
     - WhatsApp: conversaciones activas

6. `Cola operativa`
   - jobs recientes
   - errores
   - pendientes

7. `Library / Assets / Conversations`
   - según canal

---

## Qué no hacer en el frontend

- No mostrar siempre las mismas 4 gráficas con distinto título.
- No usar “mensajes contestados” como KPI central para canales donde no aplica.
- No esconder assets visuales en canales visuales.
- No mezclar métricas sintéticas con métricas reales sin indicarlo.
- No usar un mismo layout exacto para Instagram, TikTok, Email y Voice.

---

## Priorización de implementación

### Prioridad 1

- `Phone / Voice`
  - ya está vivo y genera valor inmediato

- `Instagram`
  - necesita vista visual de imágenes, reels y DMs

- `TikTok`
  - necesita vista visual de videos y comentarios

- `WhatsApp`
  - necesita inbox, templates y handoff

### Prioridad 2

- `Email`
  - necesita entregabilidad y secuencias

- `Facebook`
  - mezcla de publicación, comentarios y DMs

### Prioridad 3

- `X`
- `Messenger`
- `Automations` con tablero más analítico

---

## Recomendación de implementación en este repo

### Backend

Agregar por canal, progresivamente:

- `result_payload` más rico por job
- entidades de assets cuando aplique
- métricas agregadas por canal
- estados específicos por job
- clasificación de outcomes

### Frontend

Pasar de “resumen único” a “resumen por canal”:

- `renderInstagramSummary()`
- `renderTikTokSummary()`
- `renderEmailSummary()`
- `renderWhatsAppSummary()`
- `renderPhoneSummary()`

Y mantener una capa común solo para:

- hero
- métricas core
- jobs recientes
- estado operativo

---

## Resultado esperado

Si este plan se implementa bien, la app deja de sentirse como “un backend con muchos canales conectados” y pasa a sentirse como un verdadero centro operativo multi-canal.

La diferencia clave sería esta:

- hoy:
  - mismo dashboard, mismas métricas, mismas barras

- objetivo:
  - cada canal se ve como una operación real de ese canal
  - con assets, conversaciones, resultados y jobs específicos

---

## Siguiente paso recomendado

El siguiente paso más útil no es intentar hacer todos los canales a la vez.

La secuencia recomendada sería:

1. Rediseñar la vista de `Instagram`
   - imágenes subidas
   - reels
   - resultados por asset
   - DMs

2. Rediseñar la vista de `TikTok`
   - videos subidos
   - performance por video
   - comentarios contestados
   - leads

3. Rediseñar la vista de `WhatsApp`
   - templates
   - conversaciones
   - handoff

4. Mantener `Phone / Voice` como canal premium del producto

Si quieres, el siguiente paso te lo hago directo en el frontend: empiezo por `Instagram` y `TikTok` y convierto sus secciones para que reflejen este plan.  

---

## Matriz Operativa por Canal

Esta sección aterriza el plan a piezas concretas de producto.  
Cada tabla responde:

- `Sección`: bloque del frontend o vista de operación
- `Dato fuente`: de dónde debería salir la data
- `Gráfica`: visual recomendada
- `Prioridad`: `P1`, `P2` o `P3`
- `Backend actual`: si ya existe algo en este repo o si habría que construirlo

### Automations

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Workflows ejecutados | `automations`, `channel_jobs`, futuros `workflow_runs` | barras por volumen y estado | P1 | Parcial |
| Leads ruteados | `contacts`, `channel_jobs`, futuros eventos de routing | donut por owner o cola | P2 | No |
| CRM updates | futuros jobs `crm_update` + `result_payload` | tabla + barras por tipo de cambio | P2 | Parcial |
| Dependencias entre workflows | mapa automation -> flow -> job | grafo o lista vinculada | P3 | No |
| Errores y reintentos | `channel_job_events` | donut de error rate + tabla | P1 | Parcial |

### Email

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Emails enviados | jobs `send_email` / `send_sequence` | barras por día | P1 | Sí, base |
| Secuencias activas | flows `send_sequence`, futuros step states | funnel por secuencia | P1 | Parcial |
| Entregabilidad | `result_payload` con delivered, bounced, deferred | donut de entregabilidad | P1 | No |
| Engagement | opens, clicks, replies en `result_payload` | rings por KPI | P2 | No |
| Replies recibidas | clasificación de respuestas | donut por intención | P2 | No |
| Contactos etiquetados | jobs `tag_contact` | barras por tag | P2 | Sí, base |

### Facebook

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Posts publicados | jobs `publish_post` | tabla + barras semanales | P1 | Sí, base |
| Comentarios contestados | jobs `reply_comment` | ring de response rate | P1 | Sí, base |
| DMs contestados | jobs `reply_dm` | donut de estado de conversación | P2 | Sí, base |
| Leads capturados | jobs `capture_lead` | donut por origen | P1 | Sí, base |
| Resultado por post | `result_payload` con alcance e interacción | barras top posts | P2 | No |
| Inbox priorizado | comentarios/DMs con score | lista operativa | P3 | No |

### Instagram

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Imágenes subidas | jobs `publish_post`, futuros assets | galería + donut por estado | P1 | Parcial |
| Resultado por imagen | `result_payload` por asset | barras top imágenes | P1 | No |
| Stories publicadas | jobs `publish_story` | donut por resultado + lista | P2 | Sí, base |
| Reels publicados | jobs `publish_reel` | barras top reels | P1 | Sí, base |
| DMs contestados | jobs `reply_dm` | ring de first response rate | P1 | Sí, base |
| Librería de media | tabla o colección de assets | grid visual | P2 | No |
| Performance por formato | agregado feed/story/reel | donut por formato | P1 | No |

### X

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Posts publicados | jobs `publish_post` | barras por día | P1 | Sí, base |
| Mentions contestadas | jobs `reply_mention` | donut por estado | P1 | Sí, base |
| DMs enviados | jobs `send_dm` | donut por outcome | P2 | Sí, base |
| Threads activas | futuros payloads por thread | tabla o timeline | P2 | No |
| Engagement por post | `result_payload` por post | barras top posts | P2 | No |
| Conversaciones comerciales | mentions/DMs clasificadas | lista priorizada | P3 | No |

### TikTok

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Videos subidos | jobs `publish_video`, futuros assets | galería + donut de estado | P1 | Parcial |
| Resultado por video | `result_payload` con views, retention, shares | barras top videos | P1 | No |
| Comentarios contestados | jobs `reply_comment` | ring de comentarios respondidos | P1 | Sí, base |
| Mensajes contestados | futura inbox o DM source | donut de estado de conversación | P3 | No |
| Leads capturados | jobs `capture_lead` | donut por video o fuente | P1 | Sí, base |
| Performance por hook | metadata de asset/video | barras comparativas | P3 | No |
| Cola de reply prioritario | comentarios clasificados | lista operativa | P2 | No |

### WhatsApp

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Templates enviados | jobs `send_template` | barras por template | P1 | Sí, base |
| Conversaciones activas | jobs `reply_message`, futuros threads | donut por estado | P1 | Sí, base |
| Mensajes contestados | volumen y tiempo de respuesta | rings SLA | P1 | Parcial |
| Handoff a humano | jobs `handoff_agent` | donut de handoff rate | P1 | Sí, base |
| Leads y oportunidades | jobs + tags + contactos | barras por etapa | P2 | Parcial |
| Plantillas con mejor resultado | `result_payload` por template | top templates | P2 | No |
| Cola caliente | score de intención y urgencia | lista operativa | P2 | No |

### Messenger

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Mensajes enviados | jobs `send_message` | barras por día | P1 | Sí, base |
| Comentarios vinculados | jobs `reply_comment` | donut por estado | P2 | Sí, base |
| Conversaciones activas | futuros threads + replies | donut por fase | P1 | Parcial |
| Handoff a humano | jobs `handoff_agent` | ring de escalado | P1 | Sí, base |
| Leads capturados desde chat | contactos + jobs | barras por semana | P2 | No |
| Cola priorizada | score de urgencia | lista operativa | P3 | No |

### Phone / Voice

| Sección | Dato fuente | Gráfica | Prioridad | Backend actual |
|---|---|---|---|---|
| Agentes de voz | `call_agents` | tabla + métricas | P1 | Sí |
| Flows de voz | `call_flows` | tabla + donut por modo | P1 | Sí |
| Call jobs | `call_jobs` | donut por estado | P1 | Sí |
| Outcomes | `call_jobs.outcome` | donut por outcome | P1 | Sí |
| Transcript / resumen | `call_jobs.transcript` | lista o detalle | P1 | Sí |
| Realtime sessions | eventos realtime, job events | timeline o tabla | P2 | Parcial |
| Errores Twilio/OpenAI | `provider_error`, events | donut de fallos + tabla | P1 | Parcial |
| Calidad por flow | comparación entre flows | barras por conversión | P2 | Parcial |

---

## Qué otras cosas podríamos meter por canal

Además del plan base, estas son extensiones concretas que valdría la pena considerar.

### Instagram

- `Asset library`
  - fotos, carruseles, stories y reels reutilizables
- `Creative winner board`
  - assets con más guardados, shares o leads
- `DM intent classifier`
  - interés, objeción, soporte, spam
- `Campaign split by format`
  - qué campaña funcionó mejor en reel vs feed

### TikTok

- `Video hook analysis`
  - rendimiento por primeros segundos
- `Retention ladder`
  - caída por porcentaje del video
- `Comment heatmap`
  - videos con más comentarios comerciales
- `Lead by creator/script`
  - qué guion o plantilla convierte más

### Email

- `Step-by-step sequence health`
  - dónde se cae cada secuencia
- `Domain health`
  - rendimiento por dominio receptor
- `Reply classifier`
  - positivo, negativo, objeción, OOO, spam
- `Suggested next step`
  - follow-up recomendado por intent

### WhatsApp

- `Inbox by SLA`
  - chats dentro/fuera de tiempo
- `Template ROI`
  - qué template genera reply o venta
- `Conversation sentiment`
  - tono de la conversación
- `Escalation reasons`
  - por qué pasó a humano

### Facebook

- `Post performance leaderboard`
- `Comment to lead conversion`
- `DM backlog`
- `Evergreen post library`

### X

- `Mention monitor`
- `Thread completion tracker`
- `High-value account list`
- `Reply urgency queue`

### Messenger

- `Conversation funnel`
- `Handoff reasons`
- `Lead capture panel`
- `Pending replies queue`

### Automations

- `Workflow dependency map`
- `Error clusters`
- `Downstream impact by failure`
- `Retry effectiveness`

### Phone / Voice

- `Flow comparison`
- `Prompt comparison`
- `Outcome by script`
- `Realtime latency diagnostics`
- `Transcript QA panel`

---

## Estado del backend por canal

Esta lectura ayuda a decidir por dónde seguir.

### Lo que ya existe claramente

- Base de `accounts`, `agents`, `flows`, `jobs`, `events` en `channels`
- Catálogo de acciones por canal
- Voice con `agents`, `flows`, `jobs`, `webhooks`, `ai`, `realtime`
- Snapshot para dashboard en voz y channels

### Lo que existe solo como base, pero no como producto completo

- Jobs de channels
- Resultado final de jobs
- Flows por canal
- Agentes por canal

### Lo que falta para dashboards realmente específicos

- `result_payload` enriquecido por canal
- entidades de assets para canales visuales
- analytics agregados por canal
- threads/conversations para inbox channels
- clasificación de outcomes e intents
- métricas históricas por período

---

## Prioridad práctica de implementación

Si esto se quisiera construir de forma seria, yo priorizaría así:

1. `Phone / Voice`
   - porque ya funciona de punta a punta
   - y porque sirve como referencia de canal operativo real

2. `Instagram`
   - porque necesita una vista visual clara y diferencial

3. `TikTok`
   - por la misma razón que Instagram, pero centrado en video

4. `WhatsApp`
   - porque su valor está en el inbox y el SLA

5. `Email`
   - porque necesita analytics ricos, no solo jobs

6. `Facebook`, `X`, `Messenger`
   - después de fijar el patrón visual y operativo

---

## Siguiente paso recomendado

El siguiente paso lógico sería convertir este plan en una matriz de implementación técnica, con columnas como:

- `backend model needed`
- `API endpoint needed`
- `frontend component needed`
- `sample payload needed`
- `priority`

Si quieres, el siguiente archivo te lo hago así: `CHANNEL_IMPLEMENTATION_MATRIX.md`.  
