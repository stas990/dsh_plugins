# dsh-plugins

Личные плагины для DeepSeek Harness. Репозиторий приватный: пакеты не
публикуются в npm, установка идёт локальной ссылкой или git-спекой с `path:`.

## Плагины

| Пакет | Инструмент | Что делает |
|---|---|---|
| [`@local/dsh-diagram`](packages/diagram) | `diagram_render` | Диаграммы в SVG и PNG в фиксированном стиле: 62 иконки с алиасами, заметки и списки внутри узлов |

## Структура

```
packages/
  diagram/          # @local/dsh-diagram — самостоятельный bundle
    package.json
    cordis.patch.yml
    index.js
    lib/            # спека, раскладка, SVG, PNG, инструмент
    icons/core.json # пак иконок Lucide (ISC)
    locale/         # название и описание для Plugin Manager
    README.md
tools/              # генератор иконок, тесты, рендер-харнесс
examples/diagram/   # эталонные рендеры
```

Каждый каталог в `packages/` — отдельный npm-пакет со своим
`dsh.bundle.patch`. DSH ставит такие пакеты по одному; общий код между ними не
шарится, чтобы git-установка одного пакета не тянула соседние.

## Требования

- DeepSeek Harness 0.2.x (Desktop).
- Node.js 20+ и pnpm 9+ — для установки из git подкаталога (`path:`).
- Зависимости плагинов ставятся из npm при установке.

## Установка

Локально, из этой папки:

```
plugin_manager install_bundle → target: F:/projects/deepseek plugins/packages/diagram
```

С GitHub, прибито к коммиту (иначе DSH не сможет обновлять bundle):

```
plugin_manager install_bundle → target: github:stas990/dsh_plugins#<полный-40-символьный-sha>&path:packages/diagram
```

После установки плагин появляется в **Plugins**; настройки не требуются.
После правки кода перечитайте модуль: перезапуск DSH или `set_plugin` off/on
для записи `include:diagram-render`.

## Разработка

```powershell
pnpm install          # workspace: зависимости пакетов
pnpm test             # тесты заметок, алиасов и инструмента
pnpm icons            # пересобрать icons/core.json из tools/icon-nodes.json
pnpm render           # эталонные рендеры в tools/out
```

Тесты и рендеры запускаются напрямую через node и не требуют DSH. Модуль
`tools/make-icons.mjs` фиксирует версию Lucide 0.468.0; `tools/icon-nodes.json`
— снапшот, из которого собирается пак.

## Что не коммитится

`node_modules/`, `.pnpm-store/`, `tools/out/`. Эталонные рендеры в
`examples/` — коммитятся; они служат визуальной проверкой стиля.

## Лицензии

Код плагинов — MIT. Иконки — Lucide, ISC: текст лицензии и атрибуция в
[`packages/diagram/LICENSE-LUCIDE.txt`](packages/diagram/LICENSE-LUCIDE.txt).
