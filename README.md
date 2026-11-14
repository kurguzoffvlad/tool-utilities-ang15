# tool-utilities-ang15

Утилиты для Angular 15: безопасное выполнение Promise с логированием и без проброса исключений.

## Установка

```bash
npm install tool-utilities-ang15
```

Требуемые peer-зависимости:
- `@angular/common` ^15.2.0
- `@angular/core` ^15.2.0

Также используется `tool-log` для логирования.

## Возможности

- `AwaitTryCatchService` — выполняет Promise и возвращает `false` при ошибке вместо исключения.
- Автоматически распознаёт и разбирает `Response` (например, из `fetch`).
- Классифицирует ошибки (`TypeError`, `ReferenceError`, `Error`, unknown) и пишет их в лог.

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

### Обработка reject

```ts
const ok = await this.awaitTryCatch.send(
  Promise.reject(new Error('boom')),
  'UserComponent.reject'
); // ok === false, ошибка уйдёт в лог
```

### API

```ts
send<T = any>(promise: Promise<T>, from?: string, errorMessage?: string): Promise<T | false>;
```

- `promise` — промис для выполнения.
- `from` — метка источника вызова для логов (по умолчанию `'Не указано'`).
- `errorMessage` — текст ошибки для лога при reject (по умолчанию `'Ошибка при выполнении Promise'`).
- Возвращает результат `T`, распарсенные данные `Response` или `false` при ошибке.

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

