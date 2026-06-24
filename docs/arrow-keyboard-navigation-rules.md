# Arrow Keyboard Navigation Rules

Copy AI ID의 방향키 네비게이션은 DOM/layout-tree의 계층 구조를 기준으로 동작한다.
이 문서는 원하는 최종 규칙을 명확히 고정하기 위한 규칙서다.

## 핵심 원칙

| Key | 기본 역할 | 핵심 우선순위 |
| --- | --- | --- |
| `ArrowUp` | 부모로 올라가기 | 부모만 찾는다. left sibling으로 가지 않는다. |
| `ArrowDown` | 자식으로 내려가기 | 첫 번째 자식 → 직접 right sibling → 부모의 right sibling branch |
| `ArrowLeft` | 왼쪽 sibling으로 이동 | 직접 left sibling → 부모의 left sibling branch |
| `ArrowRight` | 오른쪽 sibling으로 이동 | 직접 right sibling → 부모의 right sibling branch |

## 용어

- **현재 요소**: 현재 hover/highlight/focus된 DOM 또는 layout-tree node.
- **부모**: 현재 요소의 직접 parent.
- **자식**: 현재 요소의 직접 child.
- **첫 번째 자식**: 현재 요소의 직접 children 중 첫 번째 child.
- **마지막 자식**: 현재 요소의 직접 children 중 마지막 child.
- **left sibling**: 같은 부모를 가진 이전 sibling.
- **right sibling**: 같은 부모를 가진 다음 sibling.
- **부모의 left sibling**: 현재 요소의 부모와 같은 레벨에 있는 이전 sibling.
- **부모의 right sibling**: 현재 요소의 부모와 같은 레벨에 있는 다음 sibling.

> 여기서 left/right는 화면 좌표가 아니라 DOM/layout-tree 순서 기준의 previous/next sibling이다.

## 최종 동작 규칙

### ArrowUp

1. 부모만 찾는다.
2. 부모가 있으면 부모를 select한다.
3. 부모가 없으면 이동하지 않는다.

`ArrowUp`은 left sibling을 찾지 않는다. left sibling 이동은 `ArrowLeft`의 역할이다.

### ArrowDown

1. 첫 번째 자식을 찾는다.
2. 첫 번째 자식이 있으면 그 자식을 select한다.
3. 자식이 없다면 직접 right sibling을 찾는다.
4. 직접 right sibling이 있으면 그 right sibling을 select한다.
5. 직접 right sibling도 없다면 부모의 right sibling을 찾는다.
6. 부모의 right sibling이 있고, 그 부모의 right sibling에 첫 번째 자식이 있으면 그 첫 번째 자식을 select한다.
7. 부모의 right sibling은 있는데 자식이 없다면 부모의 right sibling을 select한다.
8. 부모의 right sibling도 없으면 이동하지 않는다.

### ArrowLeft

1. 직접 left sibling을 찾는다.
2. 직접 left sibling이 있으면 그 left sibling을 select한다.
3. 직접 left sibling이 없다면 부모의 left sibling을 찾는다.
4. 부모의 left sibling이 있고, 그 부모의 left sibling에 마지막 자식이 있으면 그 마지막 자식을 select한다.
5. 부모의 left sibling은 있는데 자식이 없다면 부모의 left sibling을 select한다.
6. 부모의 left sibling도 없으면 이동하지 않는다.

### ArrowRight

1. 직접 right sibling을 찾는다.
2. 직접 right sibling이 있으면 그 right sibling을 select한다.
3. 직접 right sibling이 없다면 부모의 right sibling을 찾는다.
4. 부모의 right sibling이 있고, 그 부모의 right sibling에 첫 번째 자식이 있으면 그 첫 번째 자식을 select한다.
5. 부모의 right sibling은 있는데 자식이 없다면 부모의 right sibling을 select한다.
6. 부모의 right sibling도 없으면 이동하지 않는다.

## 예시 트리

```text
body
├─ header
│  ├─ logo
│  └─ nav
│     ├─ home-link
│     └─ pricing-link
├─ main
│  ├─ hero
│  │  ├─ h1
│  │  └─ p
│  └─ cards
│     ├─ card-a
│     └─ card-b
└─ footer
```

## ArrowUp 예시

### `pricing-link`에서 ArrowUp

```text
현재: body > header > nav > pricing-link
결과: nav
```

이전 sibling인 `home-link`가 있어도 `ArrowUp`은 부모인 `nav`로 이동한다.
`home-link`로 가고 싶으면 `ArrowLeft`를 누른다.

### `card-b`에서 ArrowUp

```text
현재: body > main > cards > card-b
결과: cards
```

이전 sibling인 `card-a`가 있어도 `ArrowUp`은 부모인 `cards`로 이동한다.

### `main`에서 ArrowUp

```text
현재: body > main
결과: body
```

이전 sibling인 `header`가 있어도 `ArrowUp`은 부모인 `body`로 이동한다.

## ArrowDown 예시

### `nav`에서 ArrowDown

```text
현재: body > header > nav
결과: home-link
```

`nav`에는 자식이 있으므로 첫 번째 자식인 `home-link`로 이동한다.

### `home-link`에서 ArrowDown

```text
현재: body > header > nav > home-link
결과: pricing-link
```

`home-link`에는 자식이 없고, 직접 right sibling인 `pricing-link`가 있으므로 `pricing-link`로 이동한다.

### `pricing-link`에서 ArrowDown

```text
현재: body > header > nav > pricing-link
부모: nav
부모의 right sibling: 없음
결과: 이동 없음
```

`pricing-link`에는 자식도 직접 right sibling도 없다.
부모인 `nav`에도 right sibling이 없으므로 이동하지 않는다.

### `p`에서 ArrowDown

```text
현재: body > main > hero > p
부모: hero
부모의 right sibling: cards
cards의 첫 번째 자식: card-a
결과: card-a
```

`p`에는 자식도 직접 right sibling도 없다.
부모인 `hero`의 right sibling은 `cards`이고, `cards`에는 첫 번째 자식 `card-a`가 있으므로 `card-a`로 이동한다.

### `hero`에서 ArrowDown

```text
현재: body > main > hero
결과: h1
```

`hero`에는 자식이 있으므로 right sibling인 `cards`를 보지 않고 첫 번째 자식 `h1`로 이동한다.

## ArrowLeft 예시

### `pricing-link`에서 ArrowLeft

```text
현재: body > header > nav > pricing-link
결과: home-link
```

직접 left sibling인 `home-link`가 있으므로 `home-link`로 이동한다.

### `hero`에서 ArrowLeft

```text
현재: body > main > hero
부모: main
부모의 left sibling: header
header의 마지막 자식: nav
결과: nav
```

`hero`에는 직접 left sibling이 없다.
부모인 `main`의 left sibling은 `header`이고, `header`의 마지막 자식은 `nav`이므로 `nav`로 이동한다.

### `main`에서 ArrowLeft

```text
현재: body > main
결과: header
```

직접 left sibling인 `header`가 있으므로 `header`로 이동한다.

## ArrowRight 예시

### `home-link`에서 ArrowRight

```text
현재: body > header > nav > home-link
결과: pricing-link
```

직접 right sibling인 `pricing-link`가 있으므로 `pricing-link`로 이동한다.

### `pricing-link`에서 ArrowRight

```text
현재: body > header > nav > pricing-link
부모: nav
부모의 right sibling: 없음
결과: 이동 없음
```

직접 right sibling이 없고, 부모인 `nav`의 right sibling도 없으므로 이동하지 않는다.

### `header`에서 ArrowRight

```text
현재: body > header
결과: main
```

직접 right sibling인 `main`이 있으므로 `main`으로 이동한다.

### `p`에서 ArrowRight

```text
현재: body > main > hero > p
부모: hero
부모의 right sibling: cards
cards의 첫 번째 자식: card-a
결과: card-a
```

직접 right sibling이 없으므로 부모의 right sibling인 `cards`를 찾는다.
`cards`에 첫 번째 자식 `card-a`가 있으므로 `card-a`로 이동한다.

## 구현 매핑

runtime 구현은 preview iframe의 DOM navigation과 editor layout-tree row navigation 양쪽에 동일한 규칙을 적용해야 한다.

| 영역 | 파일 | 적용 내용 |
| --- | --- | --- |
| Preview DOM navigation | `src/content/editor-bridge/navigation.ts` | hover/highlight된 실제 DOM 요소 기준 방향키 이동 |
| Editor layout tree navigation | `src/editor/components/tree/treeKeyboardNavigation.ts` | focus된 layout-tree row 기준 방향키 이동 |

