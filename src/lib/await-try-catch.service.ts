import { Injectable } from "@angular/core";
import { cyan, red } from 'tool-log';

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
	 * @returns             Результат промиса `T` либо `false` при ошибке.
	 */
	send<T = any>(promise: Promise<T>, from?: string, errorMessage?: string): Promise<T | false>;
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
	 * разбирает его через {@link handleResponse}.
	 *
	 * @example
	 * const data = await this.awaitTryCatch.send(
	 *   fetch('/api/users'),
	 *   'UsersService.load'
	 * );
	 *
	 * @param promise       Промис для выполнения.
	 * @param from          Метка источника вызова (для логов).
	 * @param errorMessage  Текст ошибки для лога при reject.
	 * @returns             Результат промиса `T`, распарсенные данные `Response` или `false` при ошибке.
	 */
	public async send<T = any>(
		promise: Promise<T>,
		from: string = 'Не указано',
		errorMessage: string = 'Ошибка при выполнении Promise'
	): Promise<T | false> {
		try {
			const result = await promise;

			// Обработка Response отдельно - fetch() возвращает не готовые данные, а объект Response
			if (result instanceof Response) {
				return await this.handleResponse(result, from) as Promise<T | false>;
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
	 * Разбирает `Response`: проверяет статус и парсит тело как JSON.
	 *
	 * @param response  Объект `Response` (обычно результат `fetch`).
	 * @param from      Метка источника вызова (для логов).
	 * @returns         Распарсенные данные или `false`, если статус не ok либо парсинг упал.
	 */
	private async handleResponse(response: Response, from: string ): Promise<any | false> {
		try {
			if (!response.ok) {
				console.error(`HTTP Error: ${response.status} ${response.statusText}`);
				return false;
			}
			const data = await response.json();
			// Чтобы получить данные, нужно вызвать один из методов:
			/*
			const data = await response.json();    // для JSON ответа
			const text = await response.text();    // для текста
			const blob = await response.blob();    // для файлов/изображений
			const formData = await response.formData(); // для form-data
			*/

			cyan('awaitTryCatch', 'Результат выполнения send (из ' + from + ' AwaitTryCatchService)', data);

			return data;
		} catch (parseError) {
			red('awaitTryCatch', 'Ошибка парсинга ответа: ', { parseError });

			return false;
		}
	}
}
