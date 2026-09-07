# Scalable E-Commerce Platform

![CI](https://github.com/Smyk-Volodymyr/scalable-e-commerce-platform/actions/workflows/ci.yml/badge.svg)

Мікросервісний бекенд інтернет-магазину: каталог, кошик, замовлення, оплата через
Stripe і сповіщення. Сервіси не ходять один в одного по базах і спілкуються або
HTTP-викликом, або подією через RabbitMQ. Мета проєкту — показати, як тримаються
разом ідемпотентність, резервування складу і transactional outbox, коли між
кроками сценарію лежить мережа, яка час від часу падає.

## Стек

| | |
|---|---|
| Рантайм | Node 22, TypeScript 5+, ESM (NodeNext) |
| HTTP | Express 5 |
| Сховища | PostgreSQL 16 (по базі на сервіс), Redis 7 (кошики) |
| Події | RabbitMQ 3.13, topic-exchange `shop.events` |
| Оплата | Stripe |
| Запуск | Docker Compose |
| Тести | Vitest + supertest, інтеграційні, проти справжніх сховищ |
| Спільний код | npm workspaces, пакет `@shop/shared` |

## Архітектура

```mermaid
flowchart LR
  client["Клієнт"]

  subgraph edge [" "]
    gw["api-gateway :3000<br/>helmet · CORS · rate limit"]
  end

  client --> gw

  gw --> user["user-service :3001"]
  gw --> product["product-service :3002"]
  gw --> cart["cart-service :3003"]
  gw --> order["order-service :3004"]
  gw --> payment["payment-service :3005"]

  user --> userdb[("PostgreSQL<br/>user_service")]
  product --> proddb[("PostgreSQL<br/>product_service")]
  cart --> redis[("Redis<br/>cart:{userId}")]
  order --> orderdb[("PostgreSQL<br/>order_service<br/>+ outbox")]
  payment --> paydb[("PostgreSQL<br/>payment_service")]
  notification["notification-service :3006"] --> notifdb[("PostgreSQL<br/>notification_service")]

  cart -. "залишок товару" .-> product
  order -. "читання кошика" .-> cart
  order -. "резерв складу" .-> product
  payment -. "статус замовлення" .-> order
  payment <-. "intent · webhook" .-> stripe(["Stripe"])

  order == "публікує order.*" ==> mq{{"RabbitMQ<br/>shop.events · topic"}}
  mq == "order.cancelled" ==> product
  mq == "order.*" ==> notification
```

Суцільні стрілки — синхронний HTTP, пунктир — виклики між сервісами,
подвійні — асинхронні події. `notification-service` навмисно не має маршруту
через шлюз: у нього немає публічного API, він лише читає чергу.

## Оформлення замовлення

```mermaid
sequenceDiagram
  autonumber
  actor U as Клієнт
  participant G as api-gateway
  participant O as order-service
  participant C as cart-service
  participant P as product-service
  participant Pay as payment-service
  participant S as Stripe
  participant MQ as RabbitMQ
  participant N as notification-service

  U->>G: POST /api/orders/checkout<br/>Idempotency-Key
  G->>O: checkout
  O->>O: ключ уже бачили? тоді віддати старе замовлення
  O->>C: GET /cart
  C-->>O: позиції і сума
  O->>P: POST /internal/reservations
  P->>P: stock -= qty, резерв active з TTL
  P-->>O: reservationId
  O->>O: одна транзакція: orders + order_items<br/>+ idempotency_keys + outbox(order.created)
  O->>P: commit резерву
  O->>C: DELETE /cart
  O-->>U: 201, замовлення в статусі pending

  Note over O,MQ: окремим циклом, поза HTTP-запитом
  O->>MQ: publish order.created
  MQ->>N: order.created
  N->>N: INSERT ON CONFLICT (message_id) DO NOTHING

  U->>G: POST /api/payments/intent
  G->>Pay: створити намір оплати
  Pay->>S: paymentIntents.create<br/>idempotencyKey = order_<id>
  S-->>Pay: clientSecret
  Pay-->>U: clientSecret
  U->>S: підтвердження оплати

  S->>Pay: webhook payment_intent.succeeded
  Pay->>Pay: перевірка підпису<br/>processed_events: перша обробка?
  Pay->>O: POST /internal/orders/:id/paid
  O->>O: status = paid + outbox(order.paid)
  O->>MQ: publish order.paid
  MQ->>N: order.paid
```

Якщо клієнт кине оформлення посередині, резерв просто протермінується і склад
повернеться сам — компенсаційна дія не потрібна.

## Сервіси

| Сервіс | Порт | Сховище | За що відповідає |
|---|---|---|---|
| `api-gateway` | 3000 | — | Єдиний вхід ззовні: CORS, helmet, rate limit, `x-request-id`, проксі на решту |
| `user-service` | 3001 | PostgreSQL | Реєстрація, вхід, refresh-токени з ротацією, профіль, ролі |
| `product-service` | 3002 | PostgreSQL | Каталог, категорії, залишки, резервування складу з TTL |
| `cart-service` | 3003 | Redis | Кошик користувача, звірка кількості з залишком |
| `order-service` | 3004 | PostgreSQL | Оформлення замовлення, ідемпотентність, скасування, outbox |
| `payment-service` | 3005 | PostgreSQL | Наміри оплати Stripe, обробка вебхуків |
| `notification-service` | 3006 | PostgreSQL | Підписка на `order.*`, сповіщення, журнал надісланого |

Спільний код (`AppError`, пул Postgres, накат міграцій, клієнт RabbitMQ,
обробники помилок, перевірка JWT) винесено в `packages/shared` і підключено
через npm workspaces.

## Запуск

```bash
# 1. Створити файл оточення
cp .env.example .env

# 2. Вписати секрети: JWT_SECRET (від 32 символів),
#    STRIPE_SECRET_KEY і STRIPE_WEBHOOK_SECRET
#    JWT_SECRET можна згенерувати: openssl rand -base64 48

# 3. Підняти все
docker compose up -d --build
```

Готовність перевіряється так:

```bash
docker compose ps          # усі 14 контейнерів мають бути healthy
curl localhost:3000/health
```

### Тести

Інтеграційні: справжні HTTP-запити через supertest до справжніх Postgres і Redis.
Тому спершу має бути піднятий Docker-стек — тести підключаються до тих самих
контейнерів, але до окремих баз із суфіксом `_test`, які створюють самі.

```bash
npm install                       # один раз: ставить усе і збирає @shop/shared
docker compose up -d              # сховища мають працювати

npm test --workspaces --if-present   # усі сервіси
npm test --workspace order-service   # один сервіс
```

## Змінні оточення

`docker compose` бере з `.env` лише три перші рядки таблиці — решта задана
в `docker-compose.yml`. Повний перелік із заглушками є в `.env.example`.

| Змінна | Сервіси | Значення в compose | Призначення |
|---|---|---|---|
| `JWT_SECRET` | усі, крім notification і gateway | з `.env` | Спільний секрет HS256, мінімум 32 символи |
| `STRIPE_SECRET_KEY` | payment | з `.env` | Секретний ключ Stripe, префікс `sk_` |
| `STRIPE_WEBHOOK_SECRET` | payment | з `.env` | Секрет підпису вебхука, префікс `whsec_` |
| `NODE_ENV` | усі | `production` | Режим роботи |
| `PORT` | усі | 3000–3006 | Порт сервісу |
| `DATABASE_URL` | user, product, order, payment, notification | `postgres://shop:shop@<svc>-db:5432/<db>` | Підключення до власної бази |
| `REDIS_URL` | cart | `redis://cart-redis:6379` | Підключення до Redis |
| `RABBITMQ_URL` | product, order, notification | `amqp://shop:shop@rabbitmq:5672` | Підключення до брокера |
| `JWT_EXPIRES_IN` | user | `15m` | Час життя access-токена |
| `REFRESH_TTL_DAYS` | user | `30` | Час життя refresh-токена |
| `BCRYPT_ROUNDS` | user | `12` | Вартість хешування пароля, 10–15 |
| `RESERVATION_TTL_MINUTES` | product | `15` | Скільки живе резерв складу до автозвільнення |
| `CART_TTL_DAYS` | cart | `30` | Скільки Redis тримає покинутий кошик |
| `PRODUCT_SERVICE_URL` | cart, order, gateway | `http://product-service:3002` | Адреса каталогу |
| `CART_SERVICE_URL` | order, gateway | `http://cart-service:3003` | Адреса кошика |
| `ORDER_SERVICE_URL` | payment, gateway | `http://order-service:3004` | Адреса замовлень |
| `USER_SERVICE_URL` | gateway | `http://user-service:3001` | Адреса користувачів |
| `PAYMENT_SERVICE_URL` | gateway | `http://payment-service:3005` | Адреса оплат |
| `CORS_ORIGIN` | gateway | `http://localhost:5173` | Дозволені джерела, через кому |

`PORT` у compose задано явно для кожного сервісу, і значення за замовчуванням у
схемах оточення збігаються з ним: 3000 у шлюза, далі 3001–3006 у порядку таблиці
сервісів. Тому запуск окремого сервісу локально без `PORT` підніме його саме на
тому порту, який очікує решта.

## Ендпоінти

Ззовні все доступно через шлюз із префіксом `/api`, який він зрізає перед
проксіюванням: `POST /api/auth/login` -> `POST /auth/login` у user-service.
Маршрути `/internal/*` шлюз не проксіює — вони лише для викликів між сервісами.

**user-service**

| Метод і шлях | Доступ | Опис |
|---|---|---|
| `POST /auth/register` | вільний | Реєстрація |
| `POST /auth/login` | вільний | Вхід, повертає пару токенів |
| `POST /auth/refresh` | вільний | Ротація пари токенів |
| `POST /auth/logout` | вільний | Погасити refresh-токен |
| `GET /users/me` | токен | Свій профіль |
| `PATCH /users/me` | токен | Змінити email або ім'я |

**product-service**

| Метод і шлях | Доступ | Опис |
|---|---|---|
| `GET /products` | вільний | Список: `page`, `limit`, `categoryId`, `search`, `sort`, `order` |
| `GET /products/:id` | вільний | Товар за ідентифікатором |
| `GET /products/slug/:slug` | вільний | Товар за slug |
| `POST /products` | admin | Створити товар |
| `PATCH /products/:id` | admin | Змінити товар |
| `DELETE /products/:id` | admin | М'яке видалення |
| `GET /categories`, `GET /categories/:id` | вільний | Категорії |
| `POST`/`PATCH`/`DELETE /categories/:id` | admin | Керування категоріями |
| `POST /internal/reservations` | внутрішній | Зарезервувати позиції під замовлення |
| `POST /internal/reservations/:id/commit` | внутрішній | Підтвердити резерв |
| `DELETE /internal/reservations/:id` | внутрішній | Скасувати резерв, повернути залишок |
| `POST /internal/reservations/:id/release` | внутрішній | Повернути залишок за підтвердженим резервом |

**cart-service**

| Метод і шлях | Доступ | Опис |
|---|---|---|
| `GET /cart` | токен | Кошик із порахованими сумами |
| `POST /cart/items` | токен | Додати товар |
| `PATCH /cart/items/:productId` | токен | Задати кількість |
| `DELETE /cart/items/:productId` | токен | Прибрати позицію |
| `DELETE /cart` | токен | Очистити кошик |

**order-service**

| Метод і шлях | Доступ | Опис |
|---|---|---|
| `POST /orders/checkout` | токен | Оформлення, обов'язковий заголовок `Idempotency-Key` (8–128 символів) |
| `GET /orders` | токен | Свої замовлення, `page` і `limit` |
| `GET /orders/:id` | токен | Своє замовлення |
| `POST /orders/:id/cancel` | токен | Скасувати замовлення в статусі `pending` |
| `POST /internal/orders/:id/paid` | внутрішній | Позначити оплаченим |

**payment-service**

| Метод і шлях | Доступ | Опис |
|---|---|---|
| `POST /payments/intent` | токен | Створити намір оплати, повертає `clientSecret` |
| `GET /payments/order/:orderId` | токен | Статус платежу за замовленням |
| `POST /payments/webhook` | підпис Stripe | Вебхук: `payment_intent.succeeded`, `payment_intent.payment_failed` |

**notification-service** — публічного API немає, лише `GET /health`.
Кожен сервіс має `GET /health`, а ті, що з базою, ще й `GET /health/db`.

## Архітектурні рішення

**Окрема база на сервіс.** JOIN між сервісами неможливий — і це головна причина
так робити. Спільна база спокушає зробити «швидкий запит у чужу таблицю», після
чого схема стає публічним API і будь-яка зміна ламає сусідів. Ціна — назви
товарів доводиться копіювати в `order_items`. Але це не дублювання, а фіксація:
замовлення має показувати ціну й назву на момент покупки, а не поточні.

**Ціни в копійках цілим числом.** `price_cents INTEGER`, ніяких `float`.
Двійковий float не має точного представлення для 0.1, тож `0.1 + 0.2` дає
`0.30000000000000004`. На одному товарі це непомітно, на звірці за місяць —
розбіжність, яку неможливо пояснити бухгалтеру. Ціле число в копійках просто не
має цього класу помилок.

**Резервування з TTL замість прямого списання.** Checkout не списує залишок
назавжди, а створює резерв, що живе `RESERVATION_TTL_MINUTES`. Якщо оформлення
обірветься посередині, компенсаційна дія не потрібна: бездіяльність і є
компенсацією — фоновий процес звільнить протерміноване. Класична «сага з
компенсацією» вимагає, щоб компенсаційний виклик дійшов, а він і є тим, що
падає найчастіше.

**Transactional outbox.** Записати в базу і надіслати в мережу атомарно
неможливо: між `COMMIT` і `publish` процес може померти, і система лишиться
із замовленням без події або з подією без замовлення. Тому подія пишеться в
таблицю `outbox` тією ж транзакцією, що й замовлення, а окремий цикл публікує її
в RabbitMQ і позначає надісланою. Це дає доставку «щонайменше один раз» — звідси
наступний пункт.

**Ідемпотентність через `Idempotency-Key` і UNIQUE в базі.** Клієнт передає ключ
у заголовку, сервіс зберігає його разом із замовленням під складеним унікальним
ключем `(key, user_id)`. Повторний запит — обірваний зв'язок, ретрай мобільного
застосунку — повертає те саме замовлення і не створює другий резерв. Гарантію дає
саме обмеження в базі, а не перевірка в коді: між `SELECT` і `INSERT` вміщується
паралельний запит. Так само працює `processed_events` у payment-service і
`message_id UNIQUE` у notification-service: доставка «щонайменше один раз»
безпечна лише тоді, коли повторна обробка нічого не змінює.

**JWT HS256 без походу в user-service.** Токен підписаний спільним секретом,
кожен сервіс перевіряє його локально. Плюс очевидний: user-service не стає
вузьким місцем і його падіння не кладе авторизацію всюди. Чесний мінус: секрет
знають усі шість сервісів, тож компрометація будь-якого дає змогу випускати
токени від імені будь-кого. У проді тут має бути RS256 — user-service підписує
приватним ключем, решта перевіряє публічним і підписувати не вміє.

**Події замість прямих викликів там, де можна.** Скасування замовлення не дзвонить
у каталог, а пише подію `order.cancelled` в outbox; каталог її читає і повертає
залишок. Тому скасування працює навіть тоді, коли каталог лежить: подія дочекається
його в черзі. Синхронний виклик у цей момент або впав би, або лишив би замовлення
скасованим, а склад — зарезервованим.

**Спільний код пакетом, а не копіюванням.** `AppError`, пул Postgres, накат
міграцій, клієнт RabbitMQ і перевірка JWT були однакові в шести сервісах. Тепер
це `packages/shared` з чотирма окремими входами (`/errors`, `/http`, `/db`,
`/rabbit`) — розділення навмисне, щоб cart-service не тягнув `pg`, а
notification-service — `jsonwebtoken`. Те, що залежить від оточення, віддано
фабриками (`createPool(url)`, `createAuth(secret)`): схема змінних у кожного
сервісу своя і лишається локальною.

## Відомі обмеження

**JWT на HS256, а не RS256.** Спільний секрет у всіх сервісах. Достатньо для
демонстрації, неприйнятно для продакшену — див. пункт про JWT вище.

**Немає dead letter queue.** Повідомлення, яке обробник не зміг обробити,
відкидається через `nack(msg, false, false)` і зникає назавжди. Потрібен DLQ із
політикою повторів, інакше єдиний баг в обробнику тихо з'їдає події.

**N+1 при читанні кошика.** `GET /cart` запитує кожен товар у каталозі окремим
HTTP-запитом. На десяти позиціях це десять запитів. Лікується пакетним
ендпоінтом `GET /products?ids=...` або кешем у Redis поруч із самим кошиком.

**Міграції накочуються в `CMD` контейнера.** Перед стартом кожен сервіс виконує
`node dist/db/migrate.js`. Просто, але при кількох репліках вони стартують
одночасно і йдуть у міграції наввипередки. Правильно — окремий крок деплою або
job, що виконується один раз.

**Сповіщення нікуди не йдуть.** `notification-service` пише лист у консоль і
рядок у базу. Реальна відправка потребує поштового провайдера.
