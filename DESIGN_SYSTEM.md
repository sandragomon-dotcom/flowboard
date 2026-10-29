# FlowBoard Design System

This guide describes how FlowBoard is meant to look and feel, based on the Figma file "FlowBoard Designs (JD) – Copy" (page "Base Designs"). It covers the sign-in screen, the boards homepage, the create-board dialog, the board view with its columns and cards, and the add-card dialog.

The design's overall feel is clean, light and friendly: a pale grey canvas, white surfaces with very soft edges, one calm blue for the main actions, and lots of breathing room.

---

## Colors

### Core palette

| Role | Color | Where it is used |
|---|---|---|
| Main text | Near-black (#0a0a0a) | Headings, card titles, form labels, button text on light backgrounds |
| Quiet text | Slate grey (#717182) | Placeholders, dates, card counts, "Add card", breadcrumbs, small field labels |
| Page background | Light grey (#f3f4f6) | The page behind the sign-in card, and the background of each column |
| Surface | White | Cards, dialogs, the sign-in panel, text fields, the top bar |
| Border | Black at 10% strength | Thin outlines on cards, text fields and dividers; so light it reads as a faint grey line |
| Primary blue | Deep sky blue (#0369a1) | The logo tile, "Sign in", "Save", the "Forgot password?" link |
| Danger red | Crimson (#d4183d) | "Delete card" |
| Field highlight | Pale indigo (#e0e7ff) | The text field the user is currently typing in (it also loses its outline) |
| Avatar | Indigo (#6366f1) | The round user initial in the top bar |
| Dialog backdrop | Dark, about half see-through | Dims the page behind a dialog |

### Notes on color
- Blue is the single action color. Almost every primary button uses it.
- One exception in the file: the "New Board" button on the homepage is **purple (#8a38f5)**, not blue. It looks like an inconsistency rather than a deliberate second accent. Decide which one wins before building.
- Colors are never the only signal. Delete is red but also says "Delete card" in words.
- The file defines no reusable color variables, so the values above were read straight off the designs.

---

## Typography

**Typeface:** Inter, used everywhere. Weights used: regular, medium and (once) semi-bold.

Text is set slightly tight at larger sizes and slightly loose in the small all-caps labels.

| Style | Size | Weight | Line height | Used for |
|---|---|---|---|---|
| Page title (sign-in) | 24 | Semi-bold | 32 | The "FlowBoard" name above the sign-in card |
| Board title | 24 | Medium | 36 | The current board's name in the secondary bar, and "My Boards" |
| Dialog and tile title | 18 | Medium | 28 | "Create board", "Card", and the project title on a board tile |
| Body and button text | 16 | Regular or medium | 24 | Navigation, buttons, text typed into fields, placeholders |
| Label and detail | 14 | Regular or medium | 20 | Column titles, card text, field labels, dates, links, "Add card", "3 columns" |
| Small caps label | 12 | Medium, all capitals, extra letter spacing | 16 | The small field labels in the add-card dialog: Description, Priority, Due Date |
| Tiny | 12 | Regular or medium | 16 | The card count in a column, the initial in the avatar |

Rules of thumb:
- Titles and key controls are medium weight. Supporting text is regular.
- Secondary text (dates, counts, placeholders) is always the quiet grey.
- Main field labels are 14 and dark; the lighter, secondary fields use the small caps style in grey.

---

## Spacing and shape

### Spacing steps
The design builds everything from a small set of steps: **4, 8, 12, 16, 24 and 32**.

- **4:** the padding around the sign-in tabs.
- **8:** tight pairings: a label and its field, an icon and its text, the gap between small items.
- **12:** gap between buttons that sit together (Cancel and Save), inside-padding on the sides of text fields, space around breadcrumbs.
- **16:** the standard gap between neighboring items: columns, board tiles, stacked form fields; and the padding inside a column.
- **24:** padding inside dialogs; the side padding of the main top bar; the gap between the sign-in tabs and the form; the gap above the add-card form.
- **32:** the side padding of the secondary bar; padding inside the sign-in card; the gap between the logo block and the card.

### Page layout
- **Top bar:** full width, 65 tall, white, with a faint line underneath. Logo and "FlowBoard" and "Boards" on the left; the user avatar and "Sign out" on the right. Side padding 24.
- **Secondary bar (board view):** full width, 69 tall, also with a faint line underneath. It shows the breadcrumb "Boards / board name" and a quiet "3 columns" note. Side padding 32.
- **Boards homepage:** content sits in a centered area about 1280 wide. The page title is on the left and the "New Board" button on the right, both on the same row, with the board tiles below in a row with 16 between them.
- **Board view:** columns run left to right starting 32 in from the edge, 24 below the secondary bar, with 16 between columns.
- **Sign-in:** everything is centered on the page: logo tile, name, tagline, then the card.

### Corner roundness
- **8:** the small tab buttons inside the sign-in toggle.
- **10:** text fields, buttons, cards, columns and board tiles (the main shape of the app).
- **14:** the large logo tile on the sign-in page.
- **16:** dialogs and the sign-in card (the roundest rectangles).
- **Fully round:** the avatar and the count bubble on a column.

### Shadows
- Surfaces on the page itself (cards, columns, tiles) have **no shadow**. They are separated by color and the faint border only.
- The **sign-in card** has a soft, medium-sized shadow beneath it.
- **Dialogs** have a larger, softer shadow that lifts them clearly off the dimmed page.

---

## Components

### Column
A column is a rounded light-grey panel (10 round, 16 padding) that holds one stage of work. From top to bottom:

1. **Header row.** The column name on the left in 14 medium, dark. On the right, a small white round bubble showing how many cards are in the column, in quiet grey.
2. **Cards.** Stacked vertically.
3. **"Add card" button.** At the bottom, quiet grey text with a small plus icon on its left, 8 apart. It has no box or outline: it looks like a text link.

Spacing: 16 between the header, the cards and the add button. The example column is 319 wide; the others are about 323 wide. Three columns sit side by side with 16 between them.

### Task card
A card is a simple white tile on the grey column:
- White fill, a faint 10%-black outline, 10 round corners.
- Inner padding about 13 on the sides and top.
- It contains the task name only, in 14 regular, dark. The design does **not** show priority, assignee, date or description on the card face. Those details appear only in the add-card dialog.
- Cards stack with the column's normal gaps and fill the column's width.

### Add-card dialog
A white dialog, 512 wide, with 16 round corners, 24 padding all around, and the large soft shadow. Content, top to bottom:

1. **Title row:** "Card" at 18 medium on the left; a small "×" close button on the right.
2. **Name:** a 14 label, then a full-width text field (white, faint outline, 10 round corners, 12 side padding and 10 top and bottom). Placeholder: "Enter card name…" in quiet grey.
3. **Description:** a small all-caps grey label, then a taller text area (about 80 high) with the placeholder "Add a description…".
4. **Priority and Due Date:** side by side, each half the width with 16 between them. Each has a small all-caps grey label and a 38-high field (a dropdown for Priority, a date picker for Due Date).
5. **Footer:** a thin dividing line across the width, then on the left a red "Delete card" text button, and on the right "Cancel" (plain dark text, no box) next to a blue "Save" button, 12 apart.

Fields are separated by 16.

### Other components in the file
- **Text field:** white with a faint outline and 10 round corners; 16 text with grey placeholder. In its active state the fill turns pale indigo and the outline disappears.
- **Primary button:** solid blue, white 16 medium text, 10 round corners, 44 tall, about 16 side padding. Used for "Sign in", "Save", "Create".
- **Plain button:** dark text, no fill or outline ("Cancel").
- **Text link:** blue, 14 regular ("Forgot password?").
- **Sign-in tabs:** a pale grey strip with three options (Password, Magic link, Sign up). The chosen tab is a white pill with a soft shadow and dark text; the others are grey text on the strip.
- **Board tile (homepage):** white, faint outline, 10 round corners, about 308 wide by 105 tall, with generous padding (about 25). A 18 medium title and a 14 grey date beneath it.
- **Create-board dialog:** the same dialog style as add-card but narrower (448), with a single "Board name" field and Cancel and Create buttons.
- **Logo:** a rounded blue tile (32 in the top bar, 48 on the sign-in screen) holding a white columns icon, next to or above the "FlowBoard" name.

---

## Gaps and things to confirm
- The Figma file has **no saved color, text or spacing variables**, so every value here was read from the individual designs. It's worth turning them into proper variables in Figma.
- The "New Board" button is purple while every other primary action is blue.
- Cards show only a title. If cards should also show priority, assignee or due date (as the current app does), the design needs a version with those details.
- The Priority dropdown's options (for example High, Medium, Low) aren't drawn in the file.
- No hover, pressed, disabled or error states are shown beyond the active text field.
- No dark mode is designed.
