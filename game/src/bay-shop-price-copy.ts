import { ruCount } from './ru.ts'

/** A conditional quote for the live unsold remainder, not money already earned. */
export function shopRemainderQuote(quantity: number, price: number): string {
  return quantity > 0
    ? `Если купят все ${quantity}: ${ruCount(quantity * price, 'монета', 'монеты', 'монет')}.`
    : 'На полке ничего не осталось.'
}

export function shopReturnLabel(quantity: number): string {
  return quantity > 0 ? `Вернуть непроданное в припасы: ${quantity}` : 'Освободить место на прилавке'
}
