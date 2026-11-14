# tool-utilities-ang15

Утилиты для Angular 15: безопасное выполнение Promise, Observable и пакетных запросов
с логированием и без проброса исключений.

## Установка

```bash
npm install tool-utilities-ang15
```

Требуемые peer-зависимости:
- `@angular/common` ^15.2.0
- `@angular/core` ^15.2.0
- `tool-log` ^0.0.18

## Возможности

- `AwaitTryCatchService` — выполняет Promise и возвращает `false` при ошибке вместо исключения.
- Автоматически распознаёт и разбирает `Response` (например, из `fetch`) в одном из режимов:
  `json` (по умолчанию), `text`, `blob`, `arrayBuffer`, `formData`.
- Классифицирует ошибки (`TypeError`, `ReferenceError`, `Error`, unknown) и пишет их в лог.
- Поддерживает `Observable` (`firstValueFrom`), таймауты и пакетное выполнение массивов промисов.
- Ни один метод сервиса не бросает исключений — при любой ошибке возвращается `false`
  (или `SettledItem` с `ok: false` для пакетных методов).

## Использование

### Обычный промис

```ts
import { AwaitTryCatchService } from 'tool-utilities-ang15';

constructor(private awaitTryCatch: AwaitTryCatchService) {}

const user = await this.awaitTryCatch.send(
  this.fetchUser(1),
  'UserComponent.load',
  'Не удалось загрузить пользователя'
);
if (user !== false) { this.user = user; }
```

### fetch — Response разберётся автоматически

```ts
const todos = await this.awaitTryCatch.send(
  fetch('https://jsonplaceholder.typicode.com/todos/1'),
  'UserComponent.todos'
);
```

### Режимы разбора Response

```ts
const html  = await this.send(fetch('/page'),  'Page.load',  undefined, 'text');
const file  = await this.send(fetch('/a.pdf'), 'File.load',  undefined, 'blob');
const bin   = await this.send(fetch('/bin'),   'Bin.load',   undefined, 'arrayBuffer');
const form  = await this.send(fetch('/form'),  'Form.load',  undefined, 'formData');
```

### Обработка reject

```ts
const ok = await this.awaitTryCatch.send(
  Promise.reject(new Error('boom')),
  'UserComponent.reject'
); // ok === false, ошибка уйдёт в лог
```

### Observable

```ts
const data = await this.awaitTryCatch.sendObservable(
  this.http.get('/api/users'),
  'UsersService.load'
);
```

### Таймаут

```ts
const data = await this.awaitTryCatch.sendWithTimeout(
  fetch('/api/slow-endpoint'),
  5000,
  'SlowEndpoint.load'
); // false при таймауте или ошибке
```

### Пакетное выполнение (`Promise.all`)

`sendAllSettled` — аналог `Promise.allSettled` с логированием: ошибка одного промиса
не валит остальные, результат — массив `SettledItem<T>` (поле `index` — позиция во входном массиве).

```ts
const results = await this.awaitTryCatch.sendAllSettled(
  urls.map(u => fetch(u)),
  'Reports.load',
  'text'
);

const loaded = results.filter(r => r.ok).map(r => r.value);
const errors = results.filter(r => !r.ok).map(r => ({ index: r.index, error: r.error }));
```

`sendAllStrict` — строгий вариант: при любой ошибке возвращает `false` (без исключения),
иначе — массив результатов в исходном порядке.

```ts
const data = await this.awaitTryCatch.sendAllStrict(
  [this.http.get('/users'), this.http.get('/posts')],
  'Dashboard.load'
);
if (data === false) { /* показать ошибку */ }
```

## API

### `send`

```ts
send<T = any>(
  promise: Promise<T>,
  from?: string,
  errorMessage?: string,
  responseMode?: ResponseMode
): Promise<T | false>;
```

- `promise` — промис для выполнения.
- `from` — метка источника вызова для логов (по умолчанию `'Не указано'`).
- `errorMessage` — текст ошибки для лога при reject (по умолчанию `'Ошибка при выполнении Promise'`).
- `responseMode` — как разбирать `Response`: `'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'` (по умолчанию `'json'`).
- Возвращает результат `T`, распарсенные данные `Response` или `false` при ошибке.

### `sendObservable`

```ts
sendObservable<T>(
  obs: Observable<T>,
  from?: string,
  errorMessage?: string,
  responseMode?: ResponseMode
): Promise<T | false>;
```

Разворачивает `Observable` через `firstValueFrom` и выполняет через `send`.

### `sendWithTimeout`

```ts
sendWithTimeout<T>(promise: Promise<T>, ms: number, from?: string): Promise<T | false>;
```

Возвращает `false`, если промис не завершился за `ms` мс или завершился ошибкой.

### `sendAllSettled`

```ts
sendAllSettled<T = any>(
  promises: Promise<T>[],
  from?: string,
  responseMode?: ResponseMode
): Promise<SettledItem<T>[]>;
```

Не бросает. Возвращает `SettledItem<T>[]` в исходном порядке.

### `sendAllStrict`

```ts
sendAllStrict<T = any>(
  promises: Promise<T>[],
  from?: string,
  responseMode?: ResponseMode
): Promise<T[] | false>;
```

Не бросает. Возвращает массив результатов либо `false`, если хоть один промис упал.

### Типы

```ts
type ResponseMode = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';

interface SettledItem<T> {
  ok: boolean;
  value?: T;
  error?: unknown;
  index: number;
}
```

## Сборка

```bash
ng build tool-utilities-ang15
```

Артефакты сборки попадают в `dist/tool-utilities-ang15`.

## Публикация

```bash
cd dist/tool-utilities-ang15
npm publish
```

## Тесты

```bash
ng test tool-utilities-ang15
```
