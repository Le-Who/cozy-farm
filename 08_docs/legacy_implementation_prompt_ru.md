# ПРОМПТ ДЛЯ АГЕНТА: нарезка ассетов, внедрение HUD, текстур и игрового функционала

Используй приложенный архив ассетов как исходный production-ready пакет для переделки текущей voxel farm игры.

Главная цель: превратить текущий прототип в аккуратный, читаемый, production-ready cozy voxel farming game prototype, который визуально и функционально следует новому референсному скриншоту, использует новые текстуры, новый HUD и переиспользуемые UI-ассеты без baked-in текста, чисел и заранее заполненных прогресс-баров.

## 1. Какие файлы использовать

В архиве есть несколько папок. Для production-версии использовать только рекомендуемые ассеты:

- `01_target_reference/target_reference_gameplay_screenshot.png`  
  Главный визуальный референс. По нему выстроить композицию, камеру, масштаб, читаемость объектов, расположение HUD и общий уровень качества.

- `02_texture_atlas/texture_atlas_5x5_voxel_farm.png`  
  Основной texture atlas для материалов сцены. Несмотря на имя файла, фактически трактуй его как atlas с 6 колонками и 5 рядами, то есть 30 тайлов. Нарезай по визуальным плиткам, а не по названию файла.

- `03_hud_recommended_alpha/hud_panel_kit_blank_alpha.png`  
  Основные пустые панели HUD и модальных окон. Использовать для top bar, task card, modal, prompt bar, notification card, speech bubble, divider elements.

- `03_hud_recommended_alpha/hud_inventory_frame_kit_blank_alpha.png`  
  Пустые слоты, рамки, item cards, selection frames и панели инвентаря.

- `03_hud_recommended_alpha/hud_primitives_blank_alpha.png`  
  Пустые прогресс-бары, отдельные fill strips, segmented meters, resource chips, toggles, checkbox/radio states и quest progress shell.

- `03_hud_recommended_alpha/hud_icon_sheet_alpha.png`  
  Набор иконок: coin, water, watering can, hoe, basket, seed pouch, backpack, chest, farmhouse, market stall, chicken, egg, carrot, cabbage, beetroot, pumpkin, leafy greens, flower, quest star, journal, settings gear, sun, moon, check mark.

Папка `04_hud_recommended_raw/` содержит исходники без alpha-cleanup. Использовать только если нужно вручную исправить маску прозрачности.

Папка `06_superseded_not_recommended/` содержит старые черновики. Их нельзя использовать в игре. В них есть baked-in числа, letters, WASD/E labels, заранее заполненные progress bars или слишком конкретные элементы, которые ломают переиспользование.

## 2. Общие правила использования ассетов

Не использовать UI-ассеты как один большой фон.

Каждый HUD-элемент должен быть отдельным переиспользуемым asset-компонентом:

- панель top bar отдельно;
- task card отдельно;
- inventory window отдельно;
- item slot отдельно;
- progress track отдельно;
- progress fill отдельно;
- icon отдельно;
- tooltip bubble отдельно;
- notification card отдельно;
- button / chip / badge отдельно.

Все текстовые значения должны отрисовываться динамически через HTML/CSS или Canvas:

- day number;
- time of day;
- coins;
- water amount;
- selected tool;
- selected seed;
- item counts;
- task progress;
- reward amounts;
- key labels;
- inventory stack counts.

Запрещено использовать картинки, где число или текст уже нарисованы внутри спрайта.

Все заполнения progress bars и meters должны строиться в рантайме:

- использовать пустой track asset;
- использовать отдельный fill strip asset;
- менять ширину fill через CSS `width`, Canvas `drawImage` crop или UV-scaling;
- не использовать заранее заполненный progress bar как финальную шкалу.

## 3. Нарезка texture atlas

Файл: `02_texture_atlas/texture_atlas_5x5_voxel_farm.png`.

Фактически воспринимай atlas как 6 колонок × 5 рядов.

Сделай скрипт нарезки:

- вход: `public/assets/textures/texture_atlas_5x5_voxel_farm.png`;
- выход: `public/assets/textures/tiles/*.png`;
- дополнительно: `src/assets/textures/textureManifest.ts`.

Нарезай тайлы по визуальной сетке. Если размеры изображения не делятся идеально на 6×5 из-за gutters или antialiasing, сделай автоматическое обнаружение границ плиток:

1. Найди вертикальные и горизонтальные светлые gutters между плитками.
2. Определи bounding box каждой плитки.
3. Обрежь каждую плитку с небольшим внутренним padding, чтобы не захватывать соседний gutter.
4. Приведи итоговые плитки к единому размеру, например 256×256 или 512×512, сохраняя pixel/voxel look.
5. Для всех текстур выставь `NearestFilter` или аккуратный pixel-friendly фильтр.

Если автоматическое обнаружение не получается, задай ручную сетку 6×5 и поправь crop rectangles вручную.

### Маппинг текстур по рядам и колонкам

Используй следующий смысловой порядок:

Ряд 1:
1. bright grass;
2. dirt cliff side / grass edge;
3. dirt path;
4. rounded stone path;
5. dark crop soil;
6. farmhouse cream plaster / light wall.

Ряд 2:
1. warm wood planks;
2. blue-purple roof tiles;
3. gray stone brick wall;
4. wooden fence;
5. wooden door / reinforced door;
6. crate wood / diagonal plank.

Ряд 3:
1. purple-white market canopy fabric;
2. stone well top;
3. windmill blade wood;
4. hay / straw;
5. hedge leaves;
6. carrot crop texture.

Ряд 4:
1. cabbage crop texture;
2. beetroot crop texture;
3. tomato crop texture;
4. pumpkin crop texture;
5. flower patch texture;
6. rocky ground.

Ряд 5:
1. water surface;
2. furrowed tilled soil;
3. leafy greens crop texture;
4. mossy stone cluster;
5. dark wood floor/planks;
6. pale sand / parchment-like ground tile.

## 4. Как применять текстуры в Three.js

Создай `TextureManager`:

- загружает все нарезанные тайлы;
- выставляет `texture.colorSpace = THREE.SRGBColorSpace`;
- выставляет `texture.magFilter = THREE.NearestFilter`;
- выставляет `texture.minFilter = THREE.NearestMipmapNearestFilter` или `THREE.NearestFilter`;
- выставляет `texture.wrapS = THREE.RepeatWrapping` и `texture.wrapT = THREE.RepeatWrapping`, если текстура должна повторяться;
- кеширует материалы, чтобы не плодить новые материалы в каждом объекте.

Создай `MaterialLibrary`:

- `grassMaterial` из bright grass;
- `cliffMaterial` из dirt cliff side;
- `dirtPathMaterial` из dirt path;
- `stonePathMaterial` из rounded stone path;
- `cropSoilMaterial` из dark crop soil и furrowed tilled soil;
- `farmhouseWallMaterial` из cream plaster;
- `woodMaterial` из warm wood planks;
- `roofPurpleMaterial` из blue-purple roof tiles;
- `stoneMaterial` из stone wall / well tile;
- `fenceMaterial` из wooden fence;
- `marketCanopyMaterial` из purple-white canopy;
- `hayMaterial` из hay;
- `waterMaterial` из water surface.

Для BoxGeometry желательно назначать разные материалы по сторонам:

- верх острова: grass;
- боковые стороны острова: dirt cliff;
- низ острова: темный dirt / shadow material;
- крыша: roofPurple;
- стены дома: cream plaster + wood trim;
- paths: dirt path или stone path;
- crop bed top: crop soil;
- crop bed border: wood.

## 5. Исправление crop readability

Критическая проблема текущего результата: растения в игре похожи на маленькие деревья и не отличаются друг от друга.

Нужно сделать crops как отдельные 3D voxel assets, а не просто одинаковые зеленые кустики.

Каждый crop plot должен иметь واضحный силуэт:

### Carrot crop

- 3–4 оранжевых корнеплода должны быть видны над землей;
- сверху короткие зеленые листья;
- форма низкая, не похожая на дерево;
- цветовой акцент: оранжевый.

### Cabbage crop

- круглые зеленые головки, низко сидящие на земле;
- 2–3 layered cube clusters на plot;
- цветовой акцент: салатовый / ярко-зеленый;
- не делать высоким.

### Beetroot crop

- фиолетово-свекольные bulbs у земли;
- несколько зеленых листьев сверху;
- цветовой акцент: purple/magenta;
- форма отличается от carrot: более круглая bulb shape.

### Pumpkin crop

- крупные оранжевые voxel pumpkins;
- лежат на земле;
- рядом короткая лоза/листья;
- не больше 2–3 pumpkin models на один plot;
- цветовой акцент: большой оранжевый объект.

### Leafy greens

- плотные низкие ряды листьев;
- без стволов;
- шире и ниже, чем seedlings;
- цветовой акцент: насыщенный зеленый.

### Seedlings

- маленькие аккуратные ростки;
- не выше 0.25–0.35 voxel unit;
- должны читаться как ранняя стадия роста.

Для каждого crop type сделать минимум 3 стадии:

- stage 0: seedling;
- stage 1: growing;
- stage 2: mature.

Смена стадии должна менять mesh/model, а не только scale. В stage 2 crop должен быть полностью узнаваемым.

## 6. Нарезка HUD/UI ассетов

Файлы:

- `hud_panel_kit_blank_alpha.png`;
- `hud_inventory_frame_kit_blank_alpha.png`;
- `hud_primitives_blank_alpha.png`;
- `hud_icon_sheet_alpha.png`.

Создай скрипт `scripts/slice-ui-assets.ts` или `scripts/slice-ui-assets.py`.

### Автоматическая нарезка

Для alpha sheets использовать connected component detection:

1. Открыть PNG с alpha channel.
2. Найти все пиксели с `alpha > 12`.
3. Найти connected components.
4. Отфильтровать шумовые компоненты меньше 16×16 px.
5. Для каждой компоненты рассчитать bounding box.
6. Расширить bounding box на 4–8 px padding, чтобы не обрезать glow/shadow.
7. Сохранить каждый asset как отдельный PNG.
8. Сформировать JSON/TS manifest:
   - `id`;
   - `sourceSheet`;
   - `x`, `y`, `width`, `height`;
   - `outputPath`;
   - `nineSlice` параметры, если применимо;
   - `category`.

После автоматической нарезки вручную переименуй элементы по смыслу.

### Пример структуры выходных файлов

```txt
public/assets/ui/
  sheets/
    hud_panel_kit_blank_alpha.png
    hud_inventory_frame_kit_blank_alpha.png
    hud_primitives_blank_alpha.png
    hud_icon_sheet_alpha.png
  panels/
    top-status-bar.png
    modal-large.png
    task-card.png
    side-list-panel.png
    notification-card.png
    prompt-bar.png
    speech-bubble.png
    badge-panel.png
    divider-gold.png
    divider-wood.png
    divider-stone-leaf.png
  slots/
    inventory-slot.png
    inventory-slot-hover.png
    inventory-slot-selected.png
    inventory-slot-disabled.png
    hotbar-slot.png
    stack-badge-empty.png
    favorite-ribbon-empty.png
    item-card.png
    frame-glow.png
    frame-nature.png
    frame-tool.png
    frame-wood-lock.png
  primitives/
    progress-track-long.png
    progress-track-medium.png
    progress-track-short.png
    progress-fill-purple.png
    progress-fill-green.png
    progress-fill-gold.png
    segmented-meter-empty.png
    resource-chip-empty.png
    counter-pill-empty.png
    checkbox-empty.png
    checkbox-checked.png
    radio-empty.png
    radio-selected.png
    toggle-shell-purple.png
    toggle-shell-green.png
    quest-progress-shell.png
  icons/
    coin.png
    water-drop.png
    watering-can.png
    hoe.png
    basket.png
    seed-pouch.png
    backpack.png
    storage-chest.png
    farmhouse.png
    market-stall.png
    chicken.png
    egg.png
    carrot.png
    cabbage.png
    beetroot.png
    pumpkin.png
    leafy-greens.png
    flower.png
    quest-star.png
    journal.png
    settings-gear.png
    sun.png
    moon.png
    check.png
```

## 7. Nine-slice / scalable panel rendering

Большие UI-панели нельзя просто растягивать целиком, иначе углы и бордеры станут размытыми.

Для panel assets реализовать 9-slice rendering:

- corners не растягиваются;
- horizontal edges растягиваются только по X;
- vertical edges растягиваются только по Y;
- center растягивается по X и Y.

Если UI сделан в HTML/CSS, можно использовать:

- `border-image-slice`;
- `border-image-width`;
- CSS backgrounds из central fill;
- либо нарезать panel на 9 отдельных PNG.

Если UI рисуется Canvas 2D, реализовать helper:

```ts
function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  src: { x: number; y: number; w: number; h: number },
  dst: { x: number; y: number; w: number; h: number },
  slice: { left: number; right: number; top: number; bottom: number }
) {}
```

Рекомендуемые slice margins:

- small slot: 12–18 px;
- compact chip/button: 18–24 px;
- prompt bar: 24–32 px;
- task card: 28–40 px;
- modal large: 36–56 px;
- tall side panel: 36–56 px.

Точные значения определить после нарезки, чтобы сохранить углы и декоративные элементы.

## 8. HUD layout

HUD должен повторять новый target screenshot, но быть построен из reusable компонентов.

### Top status bar

Расположение: верхний левый угол.

Использовать:

- `top-status-bar.png` как shell;
- icons из `hud_icon_sheet`;
- текст поверх через DOM.

Секции:

- Day;
- Time of day;
- Coins;
- Water;
- Selected tool;
- Selected seed.

Пример данных:

```ts
interface HUDStatus {
  day: number;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  coins: number;
  water: number;
  waterMax: number;
  selectedTool: ToolId;
  selectedSeed: SeedId | null;
  selectedSeedCount: number;
}
```

Все значения обновляются реактивно при изменении `GameState`.

### Top-right buttons

Расположение: верхний правый угол.

Кнопки:

- Journal / tasks;
- Inventory / backpack;
- Settings / pause.

Использовать blank icon button или square slot, поверх рисовать icon.

Клавиши `I`, `M`, `Esc` не должны быть baked-in в PNG. Отрисовывать text label поверх кнопки.

### Task card

Расположение: верхний правый угол под кнопками.

Использовать `task-card.png` или medium card shell.

Данные:

- task title;
- task objective;
- progress current/max;
- progress bar;
- reward icons + dynamic numbers.

Progress bar:

- track = empty progress track;
- fill = purple fill strip;
- width = `current / max`.

### Bottom-center control hint

Расположение: нижний центр.

Использовать prompt bar shell.

Показывать:

- movement hint;
- camera hint;
- interaction hint.

Key labels отрисовывать через CSS keycap components, не через PNG.

### Bottom-left notification / tutorial

Расположение: нижний левый угол.

Использовать notification card shell.

Показывать:

- icon слева;
- title;
- message;
- optional close button.

Notification должна исчезать автоматически через 4–6 секунд или закрываться вручную.

### Interaction prompt

Когда игрок рядом с интерактивным объектом, показывать prompt:

- `E` + action label;
- иконка действия, если есть;
- мягкая анимация fade/slide.

Prompt не должен закрывать персонажа и crop field.

## 9. Inventory UI

Инвентарь открывается клавишей `I`.

Использовать:

- large modal panel shell;
- slots из inventory frame kit;
- icons из icon sheet;
- stack count через динамический текст;
- selected slot frame отдельно;
- tabs или filters через blank tab/buttons.

Функционал:

- grid inventory;
- item quantity;
- selected item;
- item tooltip;
- item category filter;
- sellable marker;
- plantable marker;
- tool marker;
- drag/drop не обязателен, но slot click должен работать.

Нельзя рисовать quantity как часть item sprite. Число должно быть текстом поверх `stack-badge-empty.png`.

## 10. Market UI

Market stall в сцене открывает Market UI.

Использовать:

- large modal shell;
- side list panel;
- item slots;
- resource chips;
- progress/button primitives.

Табы:

- Sell;
- Buy Seeds;
- Upgrades;
- Decorations.

Функции:

- показать инвентарь sellable items;
- продать 1 item;
- продать stack;
- купить seed pack;
- купить upgrade;
- показать insufficient coins feedback;
- обновить coin count в top HUD.

Все prices и counts — динамический текст.

## 11. Storage chest UI

Treasure/storage chest открывает Storage UI.

Функции:

- player inventory слева;
- chest inventory справа;
- move item to chest;
- move item from chest;
- capacity counter;
- stack merging.

Использовать те же slots и modal panels.

## 12. Gameplay integration с новыми UI-ассетами

### GameState

Создать единый `GameState`:

```ts
interface GameState {
  day: number;
  phase: 'morning' | 'afternoon' | 'evening' | 'night';
  coins: number;
  water: number;
  waterMax: number;
  selectedTool: ToolId;
  selectedSeed: SeedId | null;
  inventory: InventoryState;
  crops: CropPlotState[];
  chickens: ChickenState[];
  tasks: TaskState[];
  upgrades: UpgradeState;
  tutorial: TutorialState;
}
```

UI должен подписываться на изменения состояния. Не обновлять HUD через случайные прямые DOM-записи из gameplay systems. Сделать `UIStore` / event bus / simple observable.

### InteractionSystem

Каждый интерактивный объект должен регистрироваться:

```ts
interface Interactable {
  id: string;
  object3D: THREE.Object3D;
  position: THREE.Vector3;
  radius: number;
  label: string;
  icon?: IconId;
  requiredTool?: ToolId;
  canInteract(state: GameState): boolean;
  interact(ctx: InteractionContext): void;
}
```

HUD interaction prompt показывает nearest available interactable.

### CropSystem

Каждый crop bed — отдельный объект и отдельное состояние.

Функции:

- prepare soil;
- plant seed;
- water crop;
- advance day;
- harvest crop;
- update mesh by growth stage;
- show harvest particles;
- add item to inventory;
- update task progress.

### ChickenSystem

Функции:

- wander in pen;
- feed chickens;
- produce eggs at day end;
- collect eggs;
- show happy notification;
- update task progress.

### DayCycleSystem

Функции:

- manual end day from farmhouse;
- end-day summary screen;
- crop growth update;
- chicken egg generation;
- task refresh;
- autosave.

## 13. Применение ассетов к сцене

Сцена должна соответствовать `target_reference_gameplay_screenshot.png`:

- island fills frame;
- camera is orthographic isometric;
- no huge empty blue border;
- buildings and crop field are correctly scaled;
- paths are curved/organic but grid-readable;
- all objects are separate modular assets;
- crop field is central and readable;
- farmhouse, chicken coop, well, windmill, market stall and chicken pen match reference positions.

### Обязательные visual fixes

1. Увеличить детализацию и пропорции объектов. Текущий результат слишком плоский и грубый.
2. Уменьшить «сеточную» очевидность grass tiles; использовать variation tiles и scatter props.
3. Сделать dirt cliffs по краям острова толще и красивее.
4. Добавить layered height: верхний уровень у дома/рынка, центральный crop field, нижний уровень chicken pen.
5. Добавить stone steps и wood stairs.
6. Заменить generic plant meshes на crop-specific voxel models.
7. Добавить читаемые flower patches, rocks, bushes, fence segments, barrels, crates, hay bales.
8. Сделать water более аккуратной: вокруг острова, не как огромная плоская квадратная плита в кадре.
9. Настроить shadows и ambient light так, чтобы объекты читались как отдельные.
10. Перенести HUD в чистые зоны экрана, не перекрывать важный gameplay.

## 14. Техническая структура проекта

Рекомендуемая структура:

```txt
src/
  assets/
    AssetRegistry.ts
    TextureManager.ts
    MaterialLibrary.ts
    cropModels.ts
    buildingModels.ts
    propModels.ts
  game/
    Game.ts
    GameState.ts
    SaveSystem.ts
    InputManager.ts
  systems/
    InteractionSystem.ts
    CropSystem.ts
    ChickenSystem.ts
    MarketSystem.ts
    InventorySystem.ts
    TaskSystem.ts
    DayCycleSystem.ts
    CollisionSystem.ts
    NotificationSystem.ts
  ui/
    UIManager.ts
    UIAssetManifest.ts
    HUD.ts
    TaskCard.ts
    InventoryUI.ts
    MarketUI.ts
    StorageUI.ts
    NotificationToast.ts
    InteractionPrompt.ts
    NineSlice.ts
  layout/
    farmLayout.ts
    placeAssets.ts
  scene/
    camera.ts
    lights.ts
    renderer.ts
    controls.ts
scripts/
  slice-texture-atlas.ts
  slice-ui-assets.ts
  generate-ui-manifest.ts
public/assets/
  textures/
  ui/
```

## 15. UI implementation approach

Предпочтительный вариант: HTML/CSS overlay поверх Three.js canvas.

Почему:

- легче масштабировать панели;
- проще обновлять текст;
- проще использовать responsive layout;
- проще делать buttons, modals, tooltips;
- легче реализовать accessibility и pointer events.

Three.js canvas должен отвечать за мир и gameplay. DOM UI должен отвечать за HUD, inventory, market, dialogs.

CSS правила:

- `pointer-events: none` для HUD-only containers;
- `pointer-events: auto` для menus/buttons;
- use CSS variables for theme colors;
- all text must be dynamic;
- panels use 9-slice background or sliced images;
- icons are `<img>` from sliced icon sprites;
- progress bars use empty track image + fill div clipped by width.

## 16. Responsive behavior

HUD должен работать на разных разрешениях:

- top status bar не должен выходить за экран;
- task card сворачивается или уменьшается на узких экранах;
- bottom prompt всегда по центру;
- notification stack не перекрывает crop field;
- inventory modal масштабируется до max-width/max-height;
- текст остается читаемым.

Использовать CSS clamp:

```css
--ui-scale: clamp(0.8, 1vw + 0.6, 1.15);
```

И применять к sizes / font sizes.

## 17. QA checklist

Перед сдачей проверить:

- ассеты нарезаны на отдельные PNG;
- в production HUD нет baked-in чисел;
- в production HUD нет baked-in WASD/E/Esc/I/M labels;
- progress bars заполняются динамически;
- item stack counts рисуются динамически;
- UI icons отделены от panels;
- texture atlas применен к материалам сцены;
- crops визуально различимы с игрового расстояния;
- carrots, cabbages, beetroots, pumpkins и leafy greens не выглядят одинаково;
- camera angle похож на target screenshot;
- island composition похожа на target screenshot;
- player не проходит через здания, fences, crop beds, well, market, trees;
- interaction prompt появляется только рядом с объектом;
- market, inventory, storage и task board открываются и закрываются;
- day cycle обновляет crops/chickens/tasks;
- save/load сохраняет inventory, coins, crops, chickens, tasks, upgrades;
- игра запускается через `npm install` и `npm run dev`.

## 18. Definition of Done

Результат считается готовым, если:

- текущий прототип визуально приблизился к `target_reference_gameplay_screenshot.png`;
- сцена не выглядит как generic tile grid;
- crop field читается сразу;
- HUD стал аккуратным и интуитивным;
- UI построен из reusable blank assets + dynamic text/icons;
- старые HUD assets с baked content не используются;
- все ключевые gameplay systems работают вместе:
  - movement;
  - interaction;
  - planting;
  - watering;
  - harvesting;
  - chicken feeding;
  - egg collection;
  - market selling/buying;
  - inventory;
  - tasks;
  - day end;
  - local save.

Главное: не просто заменить картинки. Нужно внедрить правильный asset pipeline, reusable UI system, динамические данные и readable gameplay visuals.
