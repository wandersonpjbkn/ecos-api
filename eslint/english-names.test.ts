import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

import englishNames from './english-names.js'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } })
const options = [{ legacyNames: ['Autor'], legacyFields: ['nome', 'autor', 'quem_nome'] }]
const portuguese = [{ messageId: 'portuguese' }]

tester.run('english-names', englishNames.rules['english-names'], {
  valid: [
    { code: 'const authorName = book.autor.nome', options },
    { code: 'const { nome } = req.body', options },
    { code: 'const { quem_nome: personName = "" } = body', options },
    { code: 'Autor.create({ nome: name, slug })', options },
    { code: 'const Autor = model("Autor", schema)', options },
    { code: 'interface Book { autor: string; publisher?: string }', options },
    { code: 'const todos = []; const data = load(); const cores = 4', options },
    { code: 'res.json({ error: "O autor já existe." })', options },
  ],
  invalid: [
    { code: 'const nome = req.body.nome.trim()', options, errors: portuguese },
    { code: 'const addNewSubgenero = () => {}', options, errors: portuguese },
    { code: 'function save(titulo: string) {}', options, errors: portuguese },
    { code: 'const { quem_nome: quemNome } = body', options, errors: portuguese },
    { code: 'const { editora } = body', options, errors: portuguese },
    { code: 'new Schema({ editora: { type: String } })', options, errors: portuguese },
    { code: 'const payload = { "título": title }', options, errors: portuguese },
    { code: 'interface Book { sinopse?: string }', options, errors: portuguese },
    { code: 'type ListaDeLivros = string[]', options, errors: portuguese },
    { code: 'class Prateleira {}', options, errors: portuguese },
    { code: 'try {} catch (erro) {}', options, errors: portuguese },
    { code: 'const [livro] = books', options, errors: portuguese },
  ],
})
