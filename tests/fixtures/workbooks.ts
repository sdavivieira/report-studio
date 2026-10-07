import { utils, write } from 'xlsx'
import type { BookType, WorkBook } from 'xlsx'

export function exampleWorkbook(): WorkBook {
  const book = utils.book_new()
  const sheet = utils.aoa_to_sheet(
    [
      ['Relatório de operações'],
      ['Descrição', 'Valor', 'Valor', 'Data', 'Ativo', 'Observação'],
      [
        ' Ação  cultural ',
        12.5,
        '12,50',
        new Date('2026-09-29T00:00:00Z'),
        true,
        '<img src=x onerror="alert(1)">',
      ],
      ['Café', 20, '20.00', new Date('2026-09-30T00:00:00Z'), false, ''],
      [],
      ['São João', 0, '00123', null, true, 'Fim'],
    ],
    { UTC: true },
  )
  utils.book_append_sheet(book, sheet, 'Operações')
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['Cidade', 'Total'],
      ['Belém', 42],
    ]),
    'Resumo',
  )
  utils.book_append_sheet(book, utils.aoa_to_sheet([]), 'Vazia')
  return book
}

export function workbookBytes(
  book = exampleWorkbook(),
  bookType: BookType = 'xlsx',
): ArrayBuffer {
  return write(book, { type: 'array', bookType }) as ArrayBuffer
}
