import { Injectable } from '@angular/core';

import { firstValueFrom, Observable } from 'rxjs';

import { cyan, red } from 'tool-log';

/**
 * Режим разбора тела `Response`.
 * - `json`        — `await response.json()`        (по умолчанию)
 * - `text`        — `await response.text()`
 * - `blob`        — `await response.blob()`        (файлы/изображения)
 * - `arrayBuffer` — `await response.arrayBuffer()` (бинарные данные)
 * - `formData`    — `await response.formData()`    (multipart/form-data)
 */
export type ResponseMode = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';

/**
 * Результат одного промиса в пакетном режиме ({@link AwaitTryCatchService.sendAllSettled}).
 * Исключения не бросаются: успех/ошибка описаны полями `ok` и `value`/`error`.
 */
export interface SettledItem<T> {
	/** `true` — промис завершился успешно, `false` — упал. */
	ok: boolean;
	/** Результат промиса (только при `ok === true`). */
	value?: T;
	/** Причина ошибки (только при `ok === false`). */
	error?: unknown;
	/** Индекс промиса в исходном массиве — для сопоставления с входными данными. */
	index: number;
}

/**
 * Контракт сервиса-обёртки для безопасного выполнения Promise.
 * Возвращает результат промиса либо `false` при ошибке (без проброса исключения).
 */
export interface IAwaitTryCatchService {
	/**
	 * Выполняет промис и перехватывает ошибки.
	 *
	 * @param promise       Промис, который нужно выполнить.
	 * @param from          Метка источника вызова (попадает в логи). По умолчанию `'Не указано'`.
	 * @param errorMessage  Текст ошибки для лога при reject. По умолчанию `'Ошибка при выполнении Promise'`.
	 * @param responseMode  Режим разбора `Response` (если результатом оказался `Response`). По умолчанию `'json'`.
	 * @returns             Результат промиса `T`, распарсенные данные `Response` или `false` при ошибке.
	 */
	send<T = any>(promise: Promise<T>, from?: string, errorMessage?: string, responseMode?: ResponseMode): Promise<T | false>;
}

/**
 * Сервис для безопасного выполнения Promise: перехватывает ошибки,
 * логирует результат и возвращает `false` вместо проброса исключения.
 *
 * @example
 * // Обычный промис
 * const user = await this.awaitTryCatch.send(
 *   this.fetchUser(1),
 *   'UserComponent.load',
 *   'Не удалось загрузить пользователя'
 * );
 * if (user !== false) { this.user = user; }
 *
 * @example
 * // fetch — Response разберётся автоматически (вернёт JSON или false)
 * const todos = await this.awaitTryCatch.send(
 *   fetch('https://jsonplaceholder.typicode.com/todos/1'),
 *   'UserComponent.todos'
 * );
 *
 * @example
 * // Reject: ошибка уйдёт в лог, вернётся false
 * const ok = await this.awaitTryCatch.send(
 *   Promise.reject(new Error('boom')),
 *   'UserComponent.reject'
 * );
 */
@Injectable({
	providedIn: 'root'
})
export class AwaitTryCatchService implements IAwaitTryCatchService {

	/**
	 * Классифицирует ошибку и пишет её в лог с соответствующим префиксом.
	 * Нужен, чтобы в консоли было видно тип ошибки (TypeError / ReferenceError / Error / unknown).
	 *
	 * @param e  Перехваченное значение из `catch` (тип заранее неизвестен).
	 */
	private _tryCatchErrorInfo(e: unknown): void {
		if (e instanceof TypeError) {
			red('awaitTryCatch', 'Ошибка типа: ', e.message);
		} else if (e instanceof ReferenceError) {
			red('awaitTryCatch', 'Ошибка ссылки: ', e.message);
		} else if (e instanceof Error) {
			red('awaitTryCatch', 'Ошибка: ', e.message);
		} else {
			red('awaitTryCatch', 'Неизвестная ошибка:', { error: e });
		}
	}

	/**
	 * Выполняет промис, логирует результат и перехватывает ошибки.
	 * Если результатом является `Response` (например, из `fetch`), дополнительно
	 * разбирает его через {@link handleResponse} в соответствии с `responseMode`.
	 *
	 * @example
	 * const data = await this.awaitTryCatch.send(
	 *   fetch('/api/users'),
	 *   'UsersService.load'
	 * );
	 *
	 * @example
	 * // Разобрать ответ как текст
	 * const html = await this.awaitTryCatch.send(
	 *   fetch('/page'),
	 *   'PageService.load',
	 *   undefined,
	 *   'text'
	 * );
	 *
	 * @param promise       Промис для выполнения.
	 * @param from          Метка источника вызова (для логов).
	 * @param errorMessage  Текст ошибки для лога при reject.
	 * @param responseMode  Как разбирать `Response`: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'.
	 * @returns             Результат промиса `T`, распарсенные данные `Response` или `false` при ошибке.
	 */
	public async send<T = any>(
		promise: Promise<T>,
		from: string = 'Не указано',
		errorMessage: string = 'Ошибка при выполнении Promise',
		responseMode: ResponseMode = 'json'
	): Promise<T | false> {
		// Защита от null/undefined и не-промисов: не падаем, возвращаем false
		if (promise == null || typeof (promise as any)?.then !== 'function') {
			red('awaitTryCatch', 'send получил не Promise (из ' + from + ')', { promise });

			return false;
		}

		try {
			const result = await promise;

			// Обработка Response отдельно - fetch() возвращает не готовые данные, а объект Response
			if (typeof Response !== 'undefined' && result instanceof Response) {
				return await this.handleResponse<T>(result, from, responseMode);
			}

			cyan('awaitTryCatch', 'Результат выполнения send (из ' + from + ' AwaitTryCatchService)', { result });

			return result;
		} catch (error) {
			red('awaitTryCatch', 'Ошибка выполнения send (из ' + from + ' AwaitTryCatchService)', errorMessage);
			this._tryCatchErrorInfo(error);

			return false;
		}
	}

	/**
	 * Разбирает `Response`: проверяет статус и парсит тело в соответствии с `mode`.
	 * При любой проблеме (не ok, ошибка парсинга) возвращает `false`, не бросает.
	 *
	 * @param response  Объект `Response` (обычно результат `fetch`).
	 * @param from      Метка источника вызова (для логов).
	 * @param mode      Как парсить тело: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'. По умолчанию 'json'.
	 * @returns         Распарсенные данные или `false`, если статус не ok либо парсинг упал.
	 */
	private async handleResponse<T = any>(
		response: Response,
		from: string,
		mode: ResponseMode = 'json'
	): Promise<T | false> {
		try {
			if (!response.ok) {
				red('awaitTryCatch', `HTTP Error: ${response.status} ${response.statusText}`);

				return false;
			}

			let data: any;

			switch (mode) {
				case 'text':
					data = await response.text();
					break;
				case 'blob':
					data = await response.blob();
					break;
				case 'arrayBuffer':
					data = await response.arrayBuffer();
					break;
				case 'formData':
					data = await response.formData();
					break;
				case 'json':
				default:
					data = await response.json();
					break;
			}

			cyan('awaitTryCatch', 'Результат выполнения send (из ' + from + ' AwaitTryCatchService, mode=' + mode + ')', data);

			return data as T;
		} catch (parseError) {
			red('awaitTryCatch', 'Ошибка парсинга ответа (mode=' + mode + '): ', { parseError });

			return false;
		}
	}

	/**
	 * Выполняет массив промисов параллельно и при первой ошибке возвращает `false`
	 * (не бросает исключение). Сводка об ошибках уже залогирована в {@link sendAllSettled}.
	 *
	 * @example
	 * const data = await this.awaitTryCatch.sendAllStrict(
	 *   [this.http.get('/users'), this.http.get('/posts')],
	 *   'Dashboard.load'
	 * );
	 * if (data === false) { // показать ошибку }
	 *
	 * @param promises      Массив промисов для параллельного выполнения.
	 * @param from          Метка источника вызова (для логов).
	 * @param responseMode  Как разбирать `Response` (если элемент вернул `Response`). По умолчанию 'json'.
	 * @returns             Массив результатов в исходном порядке либо `false` при любой ошибке.
	 */
	public async sendAllStrict<T = any>(
		promises: Promise<T>[],
		from: string = 'Не указано',
		responseMode: ResponseMode = 'json'
	): Promise<T[] | false> {
		const results = await this.sendAllSettled(promises, from, responseMode);

		if (results.some(r => !r.ok)) {
			return false;
		}

		return results.map(r => r.value as T);
	}

	/**
	 * Выполняет массив промисов параллельно и **не бросает** исключений.
	 * Возвращает детальный результат по каждому промису (аналог `Promise.allSettled`).
	 * Если элемент вернул `Response`, тело разбирается в соответствии с `responseMode`.
	 * Ошибка одного промиса не прерывает остальные — в массиве будет элемент с `ok: false`.
	 *
	 * @example
	 * const results = await this.awaitTryCatch.sendAllSettled(
	 *   urls.map(u => fetch(u)),
	 *   'Reports.load',
	 *   'text'
	 * );
	 * const loaded = results.filter(r => r.ok).map(r => r.value);
	 *
	 * @param promises      Массив промисов для параллельного выполнения.
	 * @param from          Метка источника вызова (для логов; в лог попадает с индексом элемента).
	 * @param responseMode  Как разбирать `Response` (если элемент вернул `Response`). По умолчанию 'json'.
	 * @returns             Массив `SettledItem<T>` в исходном порядке.
	 */
	public async sendAllSettled<T = any>(
		promises: Promise<T>[],
		from: string = 'Не указано',
		responseMode: ResponseMode = 'json'
	): Promise<SettledItem<T>[]> {
		// Предупреждаем о не-промисах в массиве (Promise.allSettled обработает их как fulfilled)
		promises.forEach((p, i) => {
			if (p == null || typeof (p as any)?.then !== 'function') {
				red('awaitTryCatch', `sendAllSettled: элемент [${i}] не Promise (из ${from})`, { promise: p });
			}
		});

		const settled = await Promise.allSettled(promises);

		return Promise.all(settled.map(async (r, index): Promise<SettledItem<T>> => {
			if (r.status === 'rejected') {
				red('awaitTryCatch', `Promise.allSettled: ошибка (из ${from}[${index}])`, { error: r.reason });

				return { ok: false, error: r.reason, index };
			}

			const value = r.value;

			// Если элемент вернул Response — разбираем тело согласно responseMode
			if (typeof Response !== 'undefined' && value instanceof Response) {
				const parsed = await this.handleResponse<T>(value, `${from}[${index}]`, responseMode);

				return parsed === false
					? { ok: false, error: 'Response parse error or !ok', index }
					: { ok: true, value: parsed as T, index };
			}

			return { ok: true, value: value as T, index };
		}));
	}

	/**
	 * Преобразует `Observable` в промис и безопасно выполняет его через {@link send}.
	 * Завершается по первому значению (`firstValueFrom`) либо по ошибке.
	 * Защищён от `null`/не-Observable — в этом случае вернёт `false`, не бросит.
	 *
	 * @example
	 * const data = await this.awaitTryCatch.sendObservable(
	 *   this.http.get('/api/users'),
	 *   'UsersService.load'
	 * );
	 *
	 * @param obs           Поток `Observable<T>`.
	 * @param from          Метка источника вызова (для логов).
	 * @param errorMessage  Текст ошибки для лога при ошибке потока.
	 * @param responseMode  Как разбирать `Response` (если поток вернёт `Response`). По умолчанию 'json'.
	 * @returns             Первое значение потока или `false` при ошибке.
	 */
	public async sendObservable<T>(
		obs: Observable<T>,
		from?: string,
		errorMessage?: string,
		responseMode: ResponseMode = 'json'
	): Promise<T | false> {
		// Защита от null/undefined и не-Observable: не падаем, возвращаем false
		if (obs == null || typeof (obs as any).subscribe !== 'function') {
			red('awaitTryCatch', 'sendObservable получил не Observable (из ' + (from ?? 'Не указано') + ')', { obs });

			return false;
		}

		return this.send(firstValueFrom(obs), from, errorMessage, responseMode);
	}

	/**
	 * Выполняет промис с ограничением времени ожидания.
	 * По истечении `ms` миллисекунд возвращает `false` (таймаут логируется), не бросает.
	 * Таймер очищается в `finally` — утечки нет.
	 *
	 * @example
	 * const data = await this.awaitTryCatch.sendWithTimeout(
	 *   fetch('/api/slow-endpoint'),
	 *   5000,
	 *   'SlowEndpoint.load'
	 * );
	 *
	 * @param promise  Промис для выполнения.
	 * @param ms       Максимальное время ожидания в миллисекундах.
	 * @param from     Метка источника вызова (для логов).
	 * @returns        Результат промиса или `false` при ошибке/таймауте.
	 */
	public async sendWithTimeout<T>(
		promise: Promise<T>,
		ms: number,
		from?: string
	): Promise<T | false> {
		let timer: ReturnType<typeof setTimeout>;

		const timeout = new Promise<never>((_, rej) => {
			timer = setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms);
		});

		try {
			return await this.send(Promise.race([promise, timeout]), from, `Таймаут ${ms}мс`);
		} finally {
			clearTimeout(timer!);
		}
	}
}
