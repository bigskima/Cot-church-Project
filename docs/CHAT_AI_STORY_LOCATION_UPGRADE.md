# COT chat, AI, story and location upgrade

This upgrade keeps existing COT domain models and permission boundaries intact while improving member-facing discovery and content utility.

## Direct messages

- The default DM directory now shows accounts the current user follows or that follow the current user.
- Existing conversations appear in the default inbox only when the other participant is in that relationship set.
- Username/name search remains global for non-blocked COT accounts so a member can start a direct message without a follow relationship.
- Group chat remains scoped to its Group.

## COT AI

The assistant uses a curated tenant-scoped knowledge view rather than unrestricted raw database access. It can use published/non-sensitive COT facts including:

- church identity and published public location
- active Expression names, codes and saved addresses
- published church story
- active leadership profiles in the current General/Expression scope
- published sermons, upcoming events and announcements
- recent community posts and available groups

The assistant deliberately excludes private prayer, counselling, giving, attendance, KYC/identity and direct-message records. Missing addresses must be reported as unpublished rather than guessed.

AI responses render useful Markdown and expose Copy and Read Aloud controls.

## Our Story and locations

- Existing `church_story` remains the source of truth for General COT story content.
- Authorized General leadership can edit/publish story fields directly from the mobile/web app.
- General COT public location is stored under `organizations.settings.public_location` and is managed separately from Expression locations.
- Expression public locations continue to use each branch's existing `branches.address` JSONB field and are edited through existing Expression settings permissions.
- Public Expression profiles render structured addresses safely.

## Copy and downloads

- AI answers, posts, sermon notes, AI sermon notes, church-story text, locations and direct-message text expose copy controls where appropriate.
- The shared media preview exposes an explicit Download action.
- Rich chat attachments expose per-file Download actions.
- Native downloads use Expo FileSystem and system sharing/save options; web uses the browser download flow.
