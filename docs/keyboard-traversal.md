# Keyboard Traversal Rules

Copy AI ID keyboard traversal follows the rendered layout-tree DOM structure. It does **not** skip nodes just because they do not have `data-ai-id`.

A highlighted node can be either:

- a **stable chip target**: a DOM node with a non-empty `data-ai-id`
- a **fallback chip target**: a DOM node without a usable `data-ai-id` that can be described by generated selector/path/context metadata

If the highlighted node has `data-ai-id`, **Space** inserts/focuses a compact notebook chip such as `el-1`. If the highlighted node does not have a usable `data-ai-id`, **Space** inserts a fallback chip when the target is still connected. The editable note shows only the chip, not the long selector/path/context metadata.

When copied, chips are represented as AI-friendly Markdown sections:

```text
## Requests

@el-1 Update the hero call-to-action. @el-2 Make this section warmer.

## Targets

### `el-1`
- Kind: stable data-ai-id target
- data-ai-id: `hero-cta-button`

### `el-2`
- Kind: fallback target (selector reliability: `nth-child`)
- Element: `section` — section "Hero"
- Selector: `main > section:nth-child(1)`
- DOM path: `body > main > section`
- Context: Hero
```

Fallback chips are less stable than real `data-ai-id` targets because they depend on the current DOM selector/path/context. Chip IDs are stable and are not renumbered after deletion or reordering, so a note can contain `el-1`, `el-3`, and `el-4`.

## Terms

- **Current node**: the highlighted DOM node in the layout tree.
- **Parent**: the current node's direct layout-tree parent.
- **Child**: a direct layout-tree child of the current node.
- **Previous / left sibling**: the sibling immediately before the current node in DOM order.
- **Next / right sibling**: the sibling immediately after the current node in DOM order.
- **Branch**: a sibling subtree reached after moving sideways or climbing to an ancestor sibling.

“Left” and “right” mean previous and next sibling in layout-tree DOM order, not visual screen position.

## Arrow key rules

| Key | Rule |
| --- | --- |
| **ArrowUp** | Move to the previous/left sibling. If there is no previous sibling, move to the parent. |
| **ArrowRight** | Move to the next/right sibling. If there is no next sibling, climb to the nearest ancestor with a next/right sibling, then enter that sibling branch at its first child. If that branch has no child, land on the branch root. |
| **ArrowDown** | Move to the first child. If there is no child, move to the next/right sibling. If there is no next sibling, climb to the nearest ancestor with a next/right sibling and land on that sibling. |
| **ArrowLeft** | Move to the previous/left sibling. If there is no previous sibling, climb to the nearest ancestor with a previous/left sibling, then enter that sibling branch at its deepest last descendant. If that branch has no child, land on the branch root. |

## Base example tree

```text
body
├─ header
│  ├─ logo[data-ai-id="site-logo"]
│  └─ nav
│     ├─ home-link[data-ai-id="home-link"]
│     └─ pricing-link[data-ai-id="pricing-link"]
├─ main
│  ├─ hero
│  │  ├─ h1[data-ai-id="hero-title"]
│  │  └─ p
│  └─ cards
│     ├─ card-a[data-ai-id="card-a"]
│     └─ card-b
└─ footer[data-ai-id="site-footer"]
```

All nodes above are keyboard-traversable: `body`, `header`, `logo`, `nav`, `home-link`, `pricing-link`, `main`, `hero`, `h1`, `p`, `cards`, `card-a`, `card-b`, and `footer`.

All connected, non-extension-owned nodes above can be copied with **Space**. Nodes with `data-ai-id` insert stable chips: `logo`, `home-link`, `pricing-link`, `h1`, `card-a`, and `footer`. Nodes without `data-ai-id`, such as `body`, `header`, `nav`, `main`, `hero`, `p`, `cards`, and `card-b`, insert generated fallback chips.

## Space examples

### Space on a node with `data-ai-id`

Current node:

```text
h1[data-ai-id="hero-title"]
```

Press **Space**:

```text
el-1
```

is inserted/focused as an atomic chip in the note panel. If copied, it is exported in Markdown with a stable target detail:

```text
## Requests

@el-1

## Targets

### `el-1`
- Kind: stable data-ai-id target
- data-ai-id: `hero-title`
```

### Space on a node without `data-ai-id`

Current node:

```text
hero
```

Press **Space**:

```text
el-2
```

is inserted/focused as an atomic fallback chip in the note panel. If copied, it is exported with fallback selector/path/context details:

```text
## Requests

@el-2

## Targets

### `el-2`
- Kind: fallback target (selector reliability: `nth-child`)
- Element: `section` — section "Hero"
- Selector: `main > section:nth-child(1)`
- DOM path: `body > main > section`
- Context: Hero
```

If the DOM changed and the target is stale or disconnected, Copy AI ID shows a stale-target error instead of inserting or revealing a reference.

## ArrowUp examples

### Previous sibling exists

Current node:

```text
pricing-link[data-ai-id="pricing-link"]
```

Press **ArrowUp** → moves to:

```text
home-link[data-ai-id="home-link"]
```

### No previous sibling, so go to parent

Current node:

```text
home-link[data-ai-id="home-link"]
```

Press **ArrowUp** → moves to:

```text
nav
```

## ArrowRight examples

### Next sibling exists

Current node:

```text
hero
```

Press **ArrowRight** → moves to:

```text
cards
```

### No next sibling, climb and enter next branch's first child

Current node:

```text
pricing-link[data-ai-id="pricing-link"]
```

`pricing-link` has no next sibling. Its parent `nav` has no next sibling. Its ancestor `header` has a next sibling: `main`.

Press **ArrowRight** → climb to `header`, move to `main`, then enter `main` at its first child:

```text
hero
```

### Next branch has no child, so land on branch root

Given this smaller tree:

```text
body
├─ aside
│  └─ button[data-ai-id="aside-button"]
└─ footer[data-ai-id="site-footer"]
```

Current node:

```text
button[data-ai-id="aside-button"]
```

Press **ArrowRight** → climb to `aside`, move to `footer`, and because `footer` has no child, land on:

```text
footer[data-ai-id="site-footer"]
```

## ArrowDown examples

### Child exists

Current node:

```text
main
```

Press **ArrowDown** → moves to first child:

```text
hero
```

### No child, next sibling exists

Current node:

```text
h1[data-ai-id="hero-title"]
```

Press **ArrowDown** → moves to:

```text
p
```

### No child and no next sibling, climb to ancestor's next sibling

Current node:

```text
p
```

`p` has no child and no next sibling. Its parent `hero` has a next sibling: `cards`.

Press **ArrowDown** → moves to:

```text
cards
```

## ArrowLeft examples

### Previous sibling exists

Current node:

```text
cards
```

Press **ArrowLeft** → moves to:

```text
hero
```

### No previous sibling, climb and enter previous branch's deepest last descendant

Current node:

```text
hero
```

`hero` has no previous sibling. Its parent `main` has a previous sibling: `header`.

Press **ArrowLeft** → climb to `main`, move to `header`, then enter the previous branch at its deepest last descendant:

```text
pricing-link[data-ai-id="pricing-link"]
```

### Previous branch has no child, so land on branch root

Given this smaller tree:

```text
body
├─ header[data-ai-id="site-header"]
└─ main
   └─ hero
```

Current node:

```text
hero
```

Press **ArrowLeft** → climb to `main`, move to `header`, and because `header` has no child, land on:

```text
header[data-ai-id="site-header"]
```
