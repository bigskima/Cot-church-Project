import { access, readFile } from 'node:fs/promises';

const files = [
  'apps/mobile/src/api.ts',
  'apps/mobile/src/components/states.tsx',
  'apps/mobile/src/state/session.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/expressions-manage.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/index.tsx',
  'apps/mobile/app/_layout.tsx',
  'apps/mobile/src/hooks/use-resource.ts',
  'apps/mobile/src/services/query-cache.ts',
  'apps/mobile/src/components/cards.tsx',
  'apps/mobile/app/(tabs)/home/index.tsx',
  'apps/mobile/app/(tabs)/_layout.tsx',
  'apps/mobile/app/general/index.tsx',
  'apps/mobile/app/general/_layout.tsx',
  'apps/mobile/app/general/explore.tsx',
  'apps/mobile/app/general/community.tsx',
  'apps/mobile/app/general/reels.tsx',
  'apps/mobile/app/general/profile.tsx',
  'apps/mobile/app/general/live/index.tsx',
  'apps/mobile/app/general/live/[id].tsx',
  'apps/mobile/app/general/watch/index.tsx',
  'apps/mobile/app/general/watch/[id].tsx',
  'apps/mobile/app/general/sermon/[id].tsx',
  'apps/mobile/app/general/event/[id].tsx',
  'apps/mobile/app/general/post/[id].tsx',
  'apps/mobile/app/general/comments/[contentId].tsx',
  'apps/mobile/app/general/giving.tsx',
  'apps/mobile/app/general/prayer.tsx',
  'apps/mobile/app/general/leadership/index.tsx',
  'apps/mobile/app/general/studio/index.tsx',
  'apps/mobile/app/index.tsx',
  'apps/mobile/app/(auth)/login.tsx',
  'apps/mobile/app/expressions/[expressionId]/_layout.tsx',
  'apps/mobile/app/expressions/[expressionId]/index.tsx',
  'apps/mobile/src/components/expression/ExpressionRouteBoundary.tsx',
  'apps/mobile/src/components/expression/ExpressionShell.tsx',
  'apps/mobile/src/components/expression/ExpressionMediaHeader.tsx',
  'apps/mobile/src/components/community/PostCard.tsx',
  'apps/mobile/app/(tabs)/discover/index.tsx',
  'apps/mobile/app/(tabs)/live/index.tsx',
  'apps/mobile/app/live/index.tsx',
  'apps/mobile/app/watch/index.tsx',
  'apps/mobile/app/(tabs)/live/[id].tsx',
  'apps/mobile/app/(tabs)/watch/index.tsx',
  'apps/mobile/app/watch/[id].tsx',
  'apps/mobile/src/features/live/LiveDiscoveryExperience.tsx',
  'apps/mobile/src/features/live/LivePlayerExperience.tsx',
  'apps/mobile/src/features/media/ReelsExperience.tsx',
  'apps/mobile/src/features/media/WatchDetailExperience.tsx',
  'apps/mobile/src/features/media/SermonDetailExperience.tsx',
  'apps/mobile/app/expressions/[expressionId]/live/index.tsx',
  'apps/mobile/app/expressions/[expressionId]/live/[streamId].tsx',
  'apps/mobile/app/expressions/[expressionId]/videos/index.tsx',
  'apps/mobile/app/expressions/[expressionId]/videos/[videoId].tsx',
  'apps/mobile/app/expressions/[expressionId]/sermons/index.tsx',
  'apps/mobile/app/expressions/[expressionId]/sermons/[sermonId].tsx',
  'apps/mobile/app/expressions/[expressionId]/reels.tsx',
  'apps/mobile/app/expressions/[expressionId]/event/[id].tsx',
  'apps/mobile/app/expressions/[expressionId]/post/[id].tsx',
  'apps/mobile/app/expressions/[expressionId]/comments/[contentId].tsx',
  'apps/mobile/app/post/[id].tsx',
  'apps/mobile/app/comments/[contentId].tsx',
  'apps/mobile/src/components/engagement/CommentsThread.tsx',
  'apps/mobile/src/components/cards/VideoCard.tsx',
  'apps/mobile/src/components/media/VideoPlayer.tsx',
  'apps/mobile/src/components/media/AudioPlayer.tsx',
  'apps/mobile/app/sermon/[id].tsx',
  'apps/mobile/app/series/[id].tsx',
  'apps/mobile/app/(tabs)/community/index.tsx',
  'apps/mobile/src/features/community/CommunityExperience.tsx',
  'apps/mobile/src/features/prayer/PrayerExperience.tsx',
  'apps/mobile/src/features/expression/ExpressionBirthdaysExperience.tsx',
  'apps/mobile/src/features/expression/ExpressionGroupsExperience.tsx',
  'apps/mobile/src/features/expression/ExpressionLeadershipExperience.tsx',
  'apps/mobile/app/expressions/[expressionId]/groups/index.tsx',
  'apps/mobile/app/expressions/[expressionId]/groups/[groupId].tsx',
  'apps/mobile/app/expressions/[expressionId]/members.tsx',
  'apps/mobile/app/expressions/[expressionId]/leadership.tsx',
  'apps/mobile/src/features/expression-management/useExpressionManagementAccess.ts',
  'apps/mobile/src/features/expression-management/ExpressionManagementGate.tsx',
  'apps/mobile/src/components/expression/ExpressionManagementHeader.tsx',
  'apps/mobile/src/features/expression-management/ExpressionManagementWorkspace.tsx',
  'apps/mobile/src/features/expression-management/ExpressionManagementHub.tsx',
  'apps/mobile/src/features/expression-management/ExpressionContentStudio.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/index.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/studio.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/live.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/sermons.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/events.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/leadership.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/invite-codes.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/access.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/settings.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/giving.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/finance.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/reel.tsx',
  'apps/mobile/app/expressions/[expressionId]/manage/video.tsx',
  'apps/mobile/app/expressions/[expressionId]/feed.tsx',
  'apps/mobile/app/expressions/[expressionId]/announcements.tsx',
  'apps/mobile/app/expressions/[expressionId]/prayer.tsx',
  'apps/mobile/app/expressions/[expressionId]/events.tsx',
  'apps/mobile/app/expressions/[expressionId]/birthdays.tsx',
  'apps/mobile/app/(tabs)/profile/index.tsx',
  'apps/mobile/app/(tabs)/profile/saved.tsx',
  'apps/mobile/app/(tabs)/profile/notifications.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/expression-governance.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/church-leadership.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/sermons-manage.tsx',
  'apps/mobile/app/(tabs)/profile/settings.tsx',
  'apps/mobile/app/expressions/index.tsx',
  'apps/mobile/app/leadership/invite-codes.tsx',
  'apps/mobile/app/reels.tsx',
  'apps/mobile/app/expression/[id]/index.tsx',
  'apps/mobile/app/event/[id].tsx',
  'apps/mobile/app/prayer/index.tsx',
  'apps/mobile/src/components/prayer/PrayerCard.tsx',
  'apps/mobile/src/features/giving/GivingScreen.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/giving-manage.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/media-studio.tsx',
  'apps/mobile/app/studio/index.tsx',
  'apps/mobile/app/studio/reel.tsx',
  'apps/mobile/app/studio/video.tsx',
  'apps/admin/src/pages/RolesAccess.tsx',
  'apps/admin/src/components/Shell.tsx',
  'apps/admin/src/pages/IntegrationsJobs.tsx',
  'apps/admin/src/pages/PaymentInfrastructure.tsx',
  'apps/admin/src/api.ts',
  'supabase/functions/streaming-broadcasts/index.ts',
  'supabase/functions/stream-access/index.ts',
  'supabase/functions/stream-presence/index.ts',
  'supabase/functions/live-interactions/index.ts',
];

await Promise.all(files.map((file) => access(file)));
const sources = new Map(
  await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')]))
);
const joined = [...sources.values()].join('\n');
const givingUi = [
  sources.get('apps/mobile/src/features/giving/GivingScreen.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/leadership/giving-manage.tsx') ?? '',
].join('\n');
const prayerUi = [
  sources.get('apps/mobile/app/prayer/index.tsx') ?? '',
  sources.get('apps/mobile/src/features/prayer/PrayerExperience.tsx') ?? '',
  sources.get('apps/mobile/src/components/prayer/PrayerCard.tsx') ?? '',
].join('\n');
const integrationsUi = sources.get('apps/admin/src/pages/IntegrationsJobs.tsx') ?? '';
const platformShellUi = sources.get('apps/admin/src/components/Shell.tsx') ?? '';
const paymentInfrastructureUi = sources.get('apps/admin/src/pages/PaymentInfrastructure.tsx') ?? '';
const profileSettingsUi = sources.get('apps/mobile/app/(tabs)/profile/settings.tsx') ?? '';
const sessionUi = sources.get('apps/mobile/src/state/session.tsx') ?? '';
const generalShellUi = sources.get('apps/mobile/app/general/_layout.tsx') ?? '';
const generalHomeUi = sources.get('apps/mobile/app/(tabs)/home/index.tsx') ?? '';
const generalProfileUi = sources.get('apps/mobile/app/(tabs)/profile/index.tsx') ?? '';
const generalGivingRouteUi = sources.get('apps/mobile/app/general/giving.tsx') ?? '';
const generalStudioRouteUi = sources.get('apps/mobile/app/general/studio/index.tsx') ?? '';
const productionCopyUi = [
  sources.get('apps/mobile/app/_layout.tsx') ?? '',
  sources.get('apps/mobile/src/components/expression/ExpressionRouteBoundary.tsx') ?? '',
  sources.get('apps/mobile/src/features/expression-management/ExpressionManagementGate.tsx') ?? '',
  sources.get('apps/mobile/src/components/expression/ExpressionManagementHeader.tsx') ?? '',
  sources.get('apps/mobile/src/features/expression-management/ExpressionManagementWorkspace.tsx') ?? '',
  sources.get('apps/mobile/src/features/expression-management/ExpressionManagementHub.tsx') ?? '',
  sources.get('apps/mobile/src/features/expression-management/ExpressionContentStudio.tsx') ?? '',
  sources.get('apps/mobile/app/expressions/[expressionId]/manage/settings.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/index.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/leadership/media-studio.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/leadership/expression-governance.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/leadership/church-leadership.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/leadership/sermons-manage.tsx') ?? '',
  sources.get('apps/mobile/app/studio/index.tsx') ?? '',
].join('\n');

const expressionNavigationUi = [
  sources.get('apps/mobile/app/expressions/[expressionId]/index.tsx') ?? '',
  sources.get('apps/mobile/app/expressions/[expressionId]/events.tsx') ?? '',
  sources.get('apps/mobile/src/features/community/CommunityExperience.tsx') ?? '',
  sources.get('apps/mobile/src/features/media/WatchDetailExperience.tsx') ?? '',
  sources.get('apps/mobile/src/features/media/ReelsExperience.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/saved.tsx') ?? '',
].join('\n');

const legacyTabUi = sources.get('apps/mobile/app/(tabs)/_layout.tsx') ?? '';

const commentProductUi = [
  sources.get('apps/mobile/app/(tabs)/community/index.tsx') ?? '',
  sources.get('apps/mobile/src/features/community/CommunityExperience.tsx') ?? '',
  sources.get('apps/mobile/app/watch/[id].tsx') ?? '',
  sources.get('apps/mobile/app/reels.tsx') ?? '',
].join('\n');

const checks = [
  [/expo-secure-store/, 'secure session persistence'],
  [/AbortController/, 'cancelled obsolete queries'],
  [/cacheSnapshot/, 'stale scoped cache visibility'],
  [/stale: boolean/, 'resource stale-data state'],
  [/contextStatus/, 'deterministic membership context state'],
  [/contextRefreshing/, 'background membership refresh state'],
  [/accessReady/, 'resolved access gate for permission-driven UI'],
  [/Getting COT ready/, 'app shell waits for resolved account context'],
  [/firstMembershipOrganization = value\.organizations\[0\]/, 'creator bootstrap authority is not persisted as membership context'],
  [/creatorOrganizations\?\.some/, 'Expression creator gating uses resolved membership context'],
  [/Resolving Platform Administration access/, 'admin shell waits for resolved platform authority'],
  [/window\.setInterval\(\(\) => void refreshAuthority\(false\), 120_000\)/, 'Platform Administration authority refreshes without re-login'],
  [/refreshWhenVisible[\s\S]*refreshAuthority\(false\)[\s\S]*visibilitychange/, 'Platform Administration revalidates authority when returning to the app'],
  [/transient background refresh must not blank already-resolved/, 'Platform Administration preserves resolved access during transient refresh failures'],
  [/setInterval\(refreshContext, 120_000\)/, 'role grants refresh without re-login'],
  [/hasPublicCapability\('public\.live_stream\.create'\)[\s\S]*Go live/, 'assigned public broadcaster live entry point'],
  [/failed background refresh must not blank already-resolved context/, 'membership refresh preserves resolved context'],
  [/name="index"[\s\S]*name="explore"[\s\S]*name="reels"[\s\S]*name="community"[\s\S]*name="profile"/, 'five canonical General product tabs'],
  [/LiveCard/, 'reusable live media'],
  [/VideoView/, 'native live player'],
  [/viewerSessionId/, 'live attendance'],
  [/REPLAY PROCESSING|PROCESSING/, 'livestream lifecycle-aware player states'],
  [/Live fellowship opens when this broadcast begins/, 'pre-live fellowship state'],
  [/Replays & recordings/, 'recording processing and replay discovery'],
  [/follow_up/, 'private live follow-up'],
  [/social-feed/, 'scoped social experience'],
  [/pathname:\s*['\"]\/general\/post\/\[id\]['\"]/, 'General community cards open canonical post detail'],
  [/posts:\s*CommunityPost\[\][\s\S]*kind:\s*'post'[\s\S]*PostCard/, 'Home includes canonical social posts in the mixed feed'],
  [/\/general\/comments\/\[contentId\]|\/expressions\/\$\{expressionId\}\/comments\/\[contentId\]/, 'media comments open canonical full-screen routes'],
  [/CommentsThread/, 'shared full-screen comment thread surface'],
  [/focusRequest/, 'post detail can focus the inline comment composer'],
  [/ResourceError/, 'section error states'],
  [/stream-access/, 'secure playback access'],
  [/public-giving/, 'tenant-safe giving resolver'],
  [/manualBankTransfer/, 'manual transfer production giving'],
  [/Church-wide/, 'church-wide giving scope'],
  [/Expression Giving Settings/, 'expression-owned giving settings'],
  [/details\?\.currencies\s*\?\?\s*\[\]/, 'server-driven giving currencies'],
  [/account\.currency\s*===\s*currency/, 'currency-filtered giving accounts'],
  [/effectivePermissions/, 'permission-aware Platform Administration navigation'],
  [/Roles & Access/, 'Platform Administration Roles & Access workspace'],
  [/public\.live_stream\.create/, 'public livestream capability UI'],
  [/hasPublicCapability/, 'public capability helper separate from Expression permissions'],
  [/canPublishPublicReels[\s\S]*hasOrganizationCapability\('media\.upload'\)[\s\S]*hasOrganizationCapability\('reels\.publish'\)/, 'Public Reel publishing uses organization-scoped authority'],
  [/canPublishExpressionReels[\s\S]*Boolean\(expression\?\.id\)[\s\S]*hasCapability\('reels\.publish'\)/, 'Expression Reel publishing requires active Expression authority'],
  [/canPublishPublicVideos[\s\S]*hasOrganizationCapability\('videos\.publish'\)/, 'Public Watch publishing uses organization-scoped authority'],
  [/canPublishExpressionVideos[\s\S]*Boolean\(expression\?\.id\)[\s\S]*hasCapability\('videos\.publish'\)/, 'Expression Watch publishing requires active Expression authority'],
  [/canPostGeneral[\s\S]*canPostExpression/, 'General and Expression publishing remain separate lanes'],
  [/visibility: broadcastScope === 'public' \? 'public' : 'branch'/, 'live broadcast destination follows selected scope'],
  [/This livestream will stay inside this Expression/, 'Expression livestream privacy copy'],
  [/Create public broadcasts from General Community/, 'backend-enforced public livestream separation'],
  [/platform-integrations/, 'real platform integration telemetry'],
  [/retry_job/, 'failed integration job retry'],
  [/set_connection_status/, 'integration connection governance'],
  [/Notification delivery/, 'notification queue telemetry'],
  [/Workflow execution/, 'workflow queue telemetry'],
  [/Integration delivery/, 'delivery queue telemetry'],
  [/signature_valid/, 'streaming webhook verification visibility'],
  [/signature_verified/, 'payment webhook verification visibility'],
  [/isStoredAuth/, 'validated mobile stored session'],
  [/isAuthState/, 'validated admin stored session'],
  [/Join an Expression/, 'public Expression join entry point'],
  [/creatorOrganizations[\s\S]*Create Expression/, 'authorized Expression creator direct entry'],
  [/enterExpression/, 'deliberate Expression entry'],
  [/leaveExpression/, 'deliberate Expression exit'],
  [/item\.id === expressionId && item\.status === 'active'/, 'Expression routes require exact active membership'],
  [/Return to General COT/, 'Expression shell provides an explicit General COT exit'],
  [/ExpressionNavigation/, 'Expression workspace owns a dedicated navigation shell'],
  [/expression:workspace-home:/, 'Expression Home uses a dedicated scoped resource identity'],
  [/context\?\.expression\?\.id[\s\S]*Redirect[\s\S]*\/expressions\//, 'General tabs cannot render while an Expression context is active'],
  [/label: 'Announcements'[\s\S]*label: 'Feed'[\s\S]*label: 'Prayer'[\s\S]*label: 'Events'[\s\S]*label: 'Birthdays'/, 'Expression shell exposes Phase 2 community destinations'],
  [/CommunityExperience scope="expression" embedded/, 'Expression feed owns a dedicated scoped route'],
  [/PrayerExperience scope="expression" embedded/, 'Expression prayer owns a dedicated scoped route'],
  [/announcements\?view=feed&branchId=/, 'Expression announcement feed requests exact Expression scope'],
  [/expression:events:[\s\S]*expressionId/, 'Expression events use exact scoped home data'],
  [/ExpressionBirthdaysExperience embedded/, 'Expression birthdays reuse a dedicated Expression experience'],
  [/label: 'Live'[\s\S]*label: 'Sermons'[\s\S]*label: 'Videos'[\s\S]*label: 'Reels'/, 'Expression shell exposes Phase 3 media destinations'],
  [/LiveDiscoveryExperience scope="expression" embedded/, 'Expression Live owns a dedicated scoped route'],
  [/LivePlayerExperience streamId=\{id\} scope="expression" embedded/, 'Expression Live player remains inside the Expression shell'],
  [/expression:videos:[\s\S]*expressionId/, 'Expression Videos use exact scoped home data'],
  [/expression:sermons:[\s\S]*expressionId/, 'Expression Sermons use exact scoped home data'],
  [/ReelsExperience scope="expression"/, 'Expression Reels own a dedicated scoped route'],
  [/videoExpressionId !== context\.expression\.id/, 'Expression Watch detail verifies exact media identity'],
  [/sermon\.expression_id !== activeExpressionId/, 'Expression sermon detail verifies exact media identity'],
  [/streamExpressionId !== activeExpressionId/, 'Expression Live detail verifies exact broadcast identity'],
  [/watch:catalogue:public:/, 'General Watch catalogue is explicitly public'],
  [/label: 'Groups'[\s\S]*label: 'Members'[\s\S]*label: 'Leadership'/, 'Expression shell exposes Phase 4 groups and people destinations'],
  [/ExpressionGroupsExperience embedded/, 'Expression Groups own a dedicated workspace route'],
  [/focusGroupId=\{id\}/, 'Expression group detail remains inside the scoped groups experience'],
  [/memberships\?view=expression-directory&expressionId=/, 'Expression member directory requests the exact route Expression ID'],
  [/This directory shows only member-facing profile information/, 'Expression member directory communicates privacy boundary'],
  [/ExpressionLeadershipExperience embedded expressionId=\{id\}/, 'Expression leadership owns a dedicated workspace route'],
  [/MANAGE EXPRESSION/, 'Expression shell owns permission-gated management navigation'],
  [/label: 'Tools'[\s\S]*label: 'Content Studio'[\s\S]*label: 'Live Studio'[\s\S]*label: 'Team Access & Ownership'[\s\S]*label: 'Expression Settings'/, 'Expression tools navigation exposes canonical management destinations'],
  [/useExpressionManagementAccess/, 'Expression operations share one capability resolver'],
  [/canManageSettings[\s\S]*branches\.update/, 'Expression Settings follows backend branches.update capability'],
  [/Only the ministry tools available to you in this Expression are shown here/, 'Expression tools use member-facing ministry language'],
  [/key: 'tools'[\s\S]*key: 'studio'[\s\S]*key: 'live'[\s\S]*key: 'sermons'[\s\S]*key: 'events'[\s\S]*key: 'access'[\s\S]*key: 'settings'/, 'Expression operations header connects layered management destinations'],
  [/EXPRESSION OPERATIONS/, 'Expression operations header communicates the private management boundary'],
  [/ExpressionManagementWorkspace[\s\S]*active="live"[\s\S]*ExpressionManagementWorkspace[\s\S]*active="sermons"[\s\S]*ExpressionManagementWorkspace[\s\S]*active="events"/, 'Expression operational routes share the management workspace frame'],
  [/manage\/reel[\s\S]*ExpressionManagementWorkspace[\s\S]*active="studio"[\s\S]*manage\/video[\s\S]*ExpressionManagementWorkspace[\s\S]*active="studio"/, 'Expression media creators stay inside Content Studio operations'],
  [/!expressionWorkspace \? \([\s\S]*ScreenHeader/, 'Reusable leadership screens suppress standalone headers inside Expression operations'],
  [/Content created here stays in this Expression\. General COT publishing is handled separately/, 'Expression Content Studio communicates product boundary'],
  [/ExpressionManagementGate[\s\S]*canManageLive/, 'Expression Live Studio route is client-gated by scoped authority'],
  [/ExpressionManagementGate[\s\S]*canManageAccess/, 'Expression governance route is client-gated by scoped authority'],
  [/branches\?id=\$\{encodeURIComponent\(id\)\}[\s\S]*method: 'PATCH'/, 'Expression Settings updates the exact active Expression'],
  [/This page updates the Expression name, member code and timezone/, 'Expression Settings stays focused on member-facing identity'],
  [/const expressionWorkspace = pathname\.startsWith\('\/expressions\/'\)/, 'Reusable management screens detect Expression workspace scope'],
  [/const canPublicBroadcast = !expressionWorkspace/, 'Expression Live Studio cannot switch into public broadcast authority'],
  [/const canPublishPublic =[\s\S]*!expressionWorkspace/, 'Expression media creators cannot switch into public publishing'],
  [/const activeScope: GivingScope = expressionWorkspace && expression \? 'expression'/, 'Expression Giving management is locked to Expression scope'],
  [/Redirect href=\{\`\/expressions\/\$\{activeExpression!\.id\}\/manage\`/, 'legacy leadership hub canonicalizes active Expression management'],
  [/Redirect href=\{\`\/expressions\/\$\{expression\.id\}\/manage\/studio\`/, 'legacy Studio canonicalizes active Expression content creation'],
  [/Tabs screenOptions=\{screenOptions\} backBehavior="history"/, 'General COT owns a dedicated tab shell'],
  [/name="index"[\s\S]*name="explore"[\s\S]*name="reels"[\s\S]*name="community"[\s\S]*name="profile"/, 'General shell exposes five canonical product destinations'],
  [/Opening General COT[\s\S]*Clearing the private Expression context/, 'General shell resolves the private-to-General boundary before rendering'],
  [/leaveExpression\(\)/, 'General route explicitly clears active Expression context'],
  [/mobile:home-feed:\$\{organizationId \|\| 'auto'\}:general/, 'General Home owns an Expression-independent resource identity'],
  [/General COT\. Open My Expressions/, 'General Home presents a stable General identity'],
  [/pathname: '\/general\/post\/\[id\]'/, 'General Home opens posts inside the General shell'],
  [/\/general\/live\/\$\{activeStream\.id\}/, 'General Home opens live media inside the General shell'],
  [/\/general\/watch\/\$\{item\.video\.id\}/, 'General Home opens Watch media inside the General shell'],
  [/\/general\/sermon\/\$\{item\.sermon\.id\}/, 'General Home opens sermons inside the General shell'],
  [/GivingScreen initialScope="church" lockedScope/, 'General Giving is locked to church-wide scope'],
  [/const expression = scope === 'expression' \? context\?\.expression : undefined/, 'shared General features ignore stale Expression context'],
  [/returnTo = expressionId \? `\/expressions\/\$\{expressionId\}\/reels` : '\/general\/reels'/, 'General Reels returns inside the General shell'],
  [/CreatorStudioScreen forcedScope="general"/, 'General Ministry Studio is explicitly church-wide'],
  [/const generalWorkspace = pathname\.startsWith\('\/general'\)/, 'shared leadership hub recognizes General workspace'],
  [/serviceTile\('\/general\/giving'/, 'General Profile routes giving through General shell'],
  [/returnTo: '\/general\/profile'/, 'General Profile authentication returns to canonical profile route'],
  [/Redirect href="\/general"/, 'app entry defaults to canonical General COT'],
  [/toUserFacingErrorMessage/, 'shared user-facing error sanitizer'],
  [/INTERNAL_COPY_PATTERN[\s\S]*permission[\s\S]*expression id/, 'technical error vocabulary is filtered before display'],
  [/refreshContext\(\);[\s\S]*activeExpressionId === expressionId[\s\S]*!membership[\s\S]*leaveExpression\(\)/, 'Expression route revalidates membership and fails closed when access changes'],
  [/\/expressions\/\$\{id\}\/event\/\$\{event\.id\}/, 'Expression event links carry exact Expression identity'],
  [/\/expressions\/\$\{expressionId\}\/comments\/\[contentId\]/, 'Expression comment links carry exact Expression identity'],
  [/postExpressionId[\s\S]*\/expressions\/\$\{postExpressionId\}\/reels/, 'Expression-shared Reels preserve exact Expression route'],
  [/key: 'live'[\s\S]*key: 'sermons'[\s\S]*key: 'videos'[\s\S]*key: 'reels'[\s\S]*EXPRESSION MEDIA/, 'Expression media header keeps media destinations connected'],
  [/\/expressions\/\$\{item\.expressionId\}\/videos\/\[videoId\]/, 'saved private videos use exact Expression identity'],
  [/\/expressions\/\$\{item\.expressionId\}\/sermons\/\[sermonId\]/, 'saved private sermons use exact Expression identity'],
  [/function generalTarget[\s\S]*LegacyTabRedirect[\s\S]*Redirect/, 'legacy tab tree is redirect-only'],
  [/context === 'expression'\) return <Redirect href="\/expressions"/, 'legacy private media links fail closed instead of inferring Expression identity'],
  [/Redirect href="\/general\/live"/, 'legacy Live root redirects to canonical General Live'],
  [/Redirect href="\/general\/watch"/, 'legacy Watch root redirects to canonical General Watch'],
    [/action: 'preview'/, 'invite-code preview flow'],
  [/action: 'redeem'/, 'invite-code redemption flow'],
  [/action: 'generate'/, 'invite-code generation flow'],
  [/codeId/, 'invite-code revocation flow'],
  [/context: 'public'/, 'public interaction request scope'],
  [/canPostGeneral[\s\S]*mode === 'authenticated' && Boolean\(organizationId\)/, 'signed-in General Community publishing'],
  [/organizationId,[\s\S]*visibility: postDestination === 'expression' \? 'branch' : 'public'/, 'explicit public post destination'],
  [/action: 'share_reel'[\s\S]*organizationId/, 'signed-in public Reel sharing'],
  [/api\.request<ProfilePayload>\('profile', \{ context: 'public' \}\)/, 'profile read is independent of church membership context'],
  [/profile-avatar'[\s\S]*context: 'public'/, 'profile photo changes are independent of church membership context'],
  [/updateContextProfile/, 'profile changes update shared session data without reselecting church context'],
  [/clearContextResources/, 'Expression cache invalidation'],
  [/public-content\?type=event&id=/, 'exact public event detail request'],
  [/Cancel Registration/, 'event registration cancellation action'],
  [/Registration Not Open/, 'event registration opening state'],
  [/Registration Closed/, 'event registration closing state'],
  [/public-content\?type=video&id=/, 'exact public video detail request'],
  [/content-media\?action=video_detail&id=/, 'exact scoped Watch detail request'],
  [/Video is being prepared/, 'Watch media processing state'],
  [/More to watch/, 'neutral long-form related-content wording'],
  [/creatorAvatar[\s\S]*creatorName[\s\S]*sourceName/, 'real Watch creator and source attribution'],
  [/onBookmark \? \([\s\S]*Options for/, 'video options render only when an action exists'],
  [/view=state/, 'server-backed video engagement state'],
  [/action: isLiked \? 'unreact' : 'react'/, 'confirmed like and unlike flow'],
  [/action: 'sync_playback'/, 'cross-device playback progress sync'],
  [/initialPositionSeconds/, 'playback position restoration'],
  [/content-media\?action=playback/, 'signed video playback resolution'],
  [/comments\.refresh\(\)/, 'comment refresh after posting'],
  [/pathname:\s*['"]\/\(auth\)\/login['"]/, 'protected interaction sign-in gating'],
  [/action:\s*['"]pray['"]/, 'prayer-wall support request'],
  [/viewer_has_prayed/, 'prayer support viewer state'],
  [/prayingIds/, 'prayer support pending state'],

  [/public-content\?type=sermon&id=/, 'exact public sermon detail request'],
  [/Enter this Expression to play its internal sermon/, 'Expression sermon playback guard'],
  [/onProgress=\{syncProgress\}/, 'sermon audio and video continuity'],
  [/useDeferredValue/, 'non-blocking public discovery search'],
  [/type: 'search'/, 'server-backed public discovery search'],
  [/PUBLIC EXPRESSION PROFILE/, 'public Expression search result boundary'],
  [/public-content\?type=series-detail&id=/, 'exact sermon series detail request'],
  [/No published messages/, 'empty sermon series state'],
  [/EXPRESSION_MEMBERSHIP_REQUIRED/, 'not-a-member state mapping'],
];

const forbiddenGivingPatterns = [
  [/card_mock_provider/, 'mock payment provider'],
  [/giving\/checkout/, 'nonexistent online giving checkout route'],
  [/QUICK_AMOUNTS|quickAmounts/, 'hardcoded giving amounts'],
  [/givingPurposes/, 'hardcoded giving purpose list'],
  [/useState\(['"]USD['"]\)/, 'hardcoded USD default'],
  [/\$\{?amount|\$20|\$50|\$100|\$250|\$500/, 'hardcoded dollar giving presentation'],
];

const forbiddenWatchCopyPatterns = [
  [/Related Teachings/, 'sermon-only Watch related-content wording'],
];

const forbiddenPermissionGatePatterns = [
  [/expression-creators\?mode=self/, 'duplicate Expression creator self-fetch in role-gated UI'],
  [/hasCapability\(['"]branches\.create['"]\)/, 'legacy branches.create client gate for canonical Expression creation'],
  [/permissions\.includes\(['"]\*['"]\)/, 'wildcard permission fallback'],
  [/hasCapability\(['"]\*['"]\)/, 'wildcard capability fallback'],
];

const forbiddenExpressionRoutingPatterns = [
  [/enterExpression[\s\S]{0,500}router\.replace\(['"]\/\(tabs\)\/home['"]\)/, 'Expression entry routed back into the General tab shell'],
];


const forbiddenGeneralHomePatterns = [
  [/params\.set\('expressionId'/, 'Expression ID injection into General Home feed'],
  [/hasCapability\(/, 'Expression-scoped capability checks in General Home'],
  [/context\?\.expression/, 'active Expression personality in General Home'],
  [/\/\(tabs\)\/live|pathname:\s*['"]\/reels['"]|router\.push\(\`\/watch\//, 'legacy media route from General Home'],
];

const forbiddenGeneralProfilePatterns = [
  [/hasCapability\(/, 'Expression-scoped capability checks in General Profile'],
  [/context\?\.expression|expression\?\./, 'active Expression personality in General Profile'],
  [/Expression Groups|Expression Birthdays|Expression Invite Codes/, 'Expression operations surfaced in General Profile'],
  [/\/\(tabs\)\/profile\/(?:saved|prayer|giving|leadership|settings|notifications)/, 'legacy profile navigation from General Profile'],
];

const forbiddenGeneralShellPatterns = [
  [/\/\(tabs\)\//, 'legacy tab route inside canonical General shell'],
];

const forbiddenGeneralGivingRoutePatterns = [
  [/scope="expression"|initialScope="expression"/, 'Expression giving destination in General Giving route'],
];

const forbiddenGeneralStudioRoutePatterns = [
  [/forcedScope="expression"/, 'Expression creator scope in General Studio route'],
];

const forbiddenProductionCopyPatterns = [
  [/Loading your COT access|Resolving Expression authority|permissions assigned to your role/i, 'developer access-loading language in member UI'],
  [/No live broadcast role assigned|PUBLIC ROLE|EXPRESSION ROLE/i, 'implementation role labels in livestream UI'],
  [/Platform Administration|Platform Authority/i, 'platform-admin implementation language in member UI'],
  [/Expression ID in the URL|immutable Expression ID|Internal routing/i, 'route identity implementation language in member UI'],
  [/validated media upload pipeline|management scope|current church scope/i, 'workflow/scope implementation language in member UI'],
  [/required authority|assigned authority|publishing authority/i, 'authority implementation language in member UI'],
  [/role does not include permission|requires publish permission|permission to manage giving|permission to view giving finance/i, 'permission-engine language in member UI'],
  [/Platform lifecycle controls/i, 'platform lifecycle implementation language in Expression settings'],
];

const forbiddenLegacyExpressionLinkPatterns = [
  [/\/event\/\$\{[^}]+\}\?context=expression/, 'generic Expression event deep link'],
  [/pathname:\s*['"]\/post\/\[id\]['"][\s\S]{0,180}scope:\s*['"]expression['"]/, 'generic Expression post deep link'],
  [/pathname:\s*['"]\/watch\/\[id\]['"][\s\S]{0,180}context:\s*['"]expression['"]/, 'generic Expression Watch deep link'],
  [/pathname:\s*['"]\/comments\/\[contentId\]['"][\s\S]{0,180}context:\s*['"]expression['"]/, 'generic Expression comments deep link'],
  [/pathname:\s*['"]\/reels['"][\s\S]{0,180}context:\s*['"]expression['"]/, 'generic Expression Reel deep link'],
];

const forbiddenSocialCopyPatterns = [
  [/Join an active Expression before sharing a Reel into General Community/, 'stale Expression-membership Reel sharing guidance'],
];

const forbiddenModalCommentPatterns = [
  [/CommentSheet/, 'bottom-sheet comments on Community, Watch, or Reels'],
];

const forbiddenPrayerPatterns = [
  [/onPray=\{\(\)\s*=>\s*\{\s*\}\}/, 'no-op prayer interaction'],
];

const forbiddenPlatformBoundaryPatterns = [
  [/platform\.giving\.(?:read|manage)|GivingConfiguration|key:\s*['"]giving['"]/, 'platform-owned church giving route'],
];

const forbiddenIntegrationPatterns = [
  [/Just now|15m ago/, 'fabricated integration activity time'],
  [/< 85ms|4 Active|HEALTHY|OPTIMAL/, 'fabricated integration health metric'],
];

const paymentCredentialChecks = [
  [/category:\s*['"]payments['"]/, 'payment credential category contract'],
  [/providerCode:/, 'payment credential provider-code contract'],
];

const missing = checks.filter(([pattern]) => !pattern.test(joined));
const forbidden = forbiddenGivingPatterns.filter(([pattern]) => pattern.test(givingUi));
const forbiddenPrayer = forbiddenPrayerPatterns.filter(([pattern]) => pattern.test(prayerUi));
const forbiddenPermissionGates = forbiddenPermissionGatePatterns.filter(([pattern]) => pattern.test(joined));
const forbiddenExpressionRouting = forbiddenExpressionRoutingPatterns.filter(([pattern]) => pattern.test(joined));
const forbiddenGeneralHome = forbiddenGeneralHomePatterns.filter(([pattern]) => pattern.test(generalHomeUi));
const forbiddenGeneralProfile = forbiddenGeneralProfilePatterns.filter(([pattern]) => pattern.test(generalProfileUi));
const forbiddenGeneralShell = forbiddenGeneralShellPatterns.filter(([pattern]) => pattern.test(generalShellUi));
const forbiddenGeneralGivingRoute = forbiddenGeneralGivingRoutePatterns.filter(([pattern]) => pattern.test(generalGivingRouteUi));
const forbiddenGeneralStudioRoute = forbiddenGeneralStudioRoutePatterns.filter(([pattern]) => pattern.test(generalStudioRouteUi));
const forbiddenProductionCopy = forbiddenProductionCopyPatterns.filter(([pattern]) => pattern.test(productionCopyUi));
const forbiddenLegacyExpressionLinks = forbiddenLegacyExpressionLinkPatterns.filter(([pattern]) => pattern.test(expressionNavigationUi));
const forbiddenSocialCopy = forbiddenSocialCopyPatterns.filter(([pattern]) => pattern.test(joined));
const forbiddenModalComments = forbiddenModalCommentPatterns.filter(([pattern]) => pattern.test(commentProductUi));
const forbiddenWatchCopy = forbiddenWatchCopyPatterns.filter(([pattern]) => pattern.test(sources.get('apps/mobile/app/watch/[id].tsx') ?? ''));
const forbiddenPlatformBoundaries = forbiddenPlatformBoundaryPatterns.filter(([pattern]) => pattern.test(platformShellUi));
const forbiddenIntegrations = forbiddenIntegrationPatterns.filter(([pattern]) => pattern.test(integrationsUi));
const missingPaymentCredentialChecks = paymentCredentialChecks.filter(([pattern]) => !pattern.test(paymentInfrastructureUi));

if (missing.length || forbidden.length || forbiddenPrayer.length || forbiddenPermissionGates.length || forbiddenExpressionRouting.length || forbiddenGeneralHome.length || forbiddenGeneralProfile.length || forbiddenGeneralShell.length || forbiddenGeneralGivingRoute.length || forbiddenGeneralStudioRoute.length || forbiddenProductionCopy.length || forbiddenLegacyExpressionLinks.length || forbiddenSocialCopy.length || forbiddenModalComments.length || forbiddenWatchCopy.length || forbiddenPlatformBoundaries.length || forbiddenIntegrations.length || missingPaymentCredentialChecks.length) {
  const failures = [
    ...missing.map(([, name]) => name),
    ...forbidden.map(([, name]) => `remove ${name}`),
    ...forbiddenPrayer.map(([, name]) => `remove ${name}`),
    ...forbiddenPermissionGates.map(([, name]) => `remove ${name}`),
    ...forbiddenExpressionRouting.map(([, name]) => `remove ${name}`),
    ...forbiddenGeneralHome.map(([, name]) => `remove ${name}`),
    ...forbiddenGeneralProfile.map(([, name]) => `remove ${name}`),
    ...forbiddenGeneralShell.map(([, name]) => `remove ${name}`),
    ...forbiddenGeneralGivingRoute.map(([, name]) => `remove ${name}`),
    ...forbiddenGeneralStudioRoute.map(([, name]) => `remove ${name}`),
    ...forbiddenProductionCopy.map(([, name]) => `remove ${name}`),
    ...forbiddenLegacyExpressionLinks.map(([, name]) => `remove ${name}`),
    ...forbiddenSocialCopy.map(([, name]) => `remove ${name}`),
    ...forbiddenModalComments.map(([, name]) => `remove ${name}`),
    ...forbiddenWatchCopy.map(([, name]) => `remove ${name}`),
    ...forbiddenPlatformBoundaries.map(([, name]) => `remove ${name}`),
    ...forbiddenIntegrations.map(([, name]) => `remove ${name}`),
    ...missingPaymentCredentialChecks.map(([, name]) => name),
  ];
  console.error(`Application check failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(
  `Application check passed (${files.length} files, ${checks.length} production invariants, ${forbiddenGivingPatterns.length + forbiddenPrayerPatterns.length + forbiddenPermissionGatePatterns.length + forbiddenExpressionRoutingPatterns.length + forbiddenGeneralHomePatterns.length + forbiddenGeneralProfilePatterns.length + forbiddenGeneralShellPatterns.length + forbiddenGeneralGivingRoutePatterns.length + forbiddenGeneralStudioRoutePatterns.length + forbiddenProductionCopyPatterns.length + forbiddenLegacyExpressionLinkPatterns.length + forbiddenSocialCopyPatterns.length + forbiddenModalCommentPatterns.length + forbiddenWatchCopyPatterns.length + forbiddenPlatformBoundaryPatterns.length + forbiddenIntegrationPatterns.length} anti-hardcode/boundary checks, ${paymentCredentialChecks.length} payment contract checks).`,
);
