/**
 * Avivi Designer demo mode (no API key): scripted, grounded answers for the requests
 * visitors actually make. Keyword matching in Hebrew, English, Russian and French.
 * Every answer follows the live contract (reply, cards, suggestions, handoff).
 */
import type { DesignerCard, DesignerReply } from './knowledge';

type L = 'he' | 'en' | 'ru' | 'fr';
type T = Record<L, string>;

interface Intent {
  id: string;
  match: RegExp;
  reply: T;
  cards: (l: L) => DesignerCard[];
  suggest: T[];
  handoff?: boolean;
}

const card = (type: DesignerCard['type'], title: string, text: string, path: string, items: string[] = []): DesignerCard => ({ type, title, text, path, items });

/* Word-safe matchers. Hebrew and Cyrillic letters are not \w in JS, so \b cannot be used for them. */
const HE_L = '\\u0590-\\u05FF';
const CY_L = 'а-яё';
const LA_L = 'a-zà-ÿœ';
/** Whole Hebrew word, allowing up to two one-letter prefixes (ה ו ב ל מ ש כ). */
const hw = (w: string) => `(?:^|[^${HE_L}])[הובלמשכ]{0,2}(?:${w})(?![${HE_L}])`;
/** Whole Cyrillic word. */
const cw = (w: string) => `(?:^|[^${CY_L}])(?:${w})(?![${CY_L}])`;
/** Whole Latin word (accents included). */
const lw = (w: string) => `(?:^|[^${LA_L}])(?:${w})(?![${LA_L}])`;
const rx = (...parts: string[]) => new RegExp(parts.filter(Boolean).join('|'), 'i');

const S = {
  small: { he: 'מטבח קטן בדירה בתל אביב', en: 'A small kitchen in a Tel Aviv apartment', ru: 'Маленькая кухня в квартире в Тель-Авиве', fr: 'Une petite cuisine à Tel-Aviv' },
  island: { he: 'מטבח משפחתי עם אי', en: 'A family kitchen with an island', ru: 'Семейная кухня с островом', fr: 'Une cuisine familiale avec îlot' },
  dark: { he: 'מטבח מודרני כהה', en: 'A dark modern kitchen', ru: 'Тёмная современная кухня', fr: 'Une cuisine moderne sombre' },
  bring: { he: 'מה להביא לפגישה?', en: 'What should I bring to the meeting?', ru: 'Что взять на встречу?', fr: 'Que dois-je apporter au rendez-vous ?' },
  price: { he: 'כמה עולה מטבח?', en: 'How much does a kitchen cost?', ru: 'Сколько стоит кухня?', fr: 'Combien coûte une cuisine ?' },
  veneer: { he: 'פורניר או לכה?', en: 'Veneer or lacquer?', ru: 'Шпон или лак?', fr: 'Placage ou laque ?' },
  lighting: { he: 'איך לתכנן תאורה?', en: 'How should I plan the lighting?', ru: 'Как спланировать свет?', fr: 'Comment prévoir l’éclairage ?' },
  showroom: { he: 'איפה אולמות התצוגה?', en: 'Where are the showrooms?', ru: 'Где находятся салоны?', fr: 'Où sont les showrooms ?' },
  developer: { he: 'שדרוג מטבח קבלן', en: 'Upgrading a developer kitchen', ru: 'Апгрейд кухни застройщика', fr: 'Améliorer la cuisine du promoteur' },
  marble: { he: 'איך שומרים על שיש?', en: 'How do I look after marble?', ru: 'Как ухаживать за мрамором?', fr: 'Comment entretenir le marbre ?' },
  process: { he: 'איך עובד תהליך הרכישה?', en: 'How does the purchase process work?', ru: 'Как проходит покупка?', fr: 'Comment se passe l’achat ?' },
  human: { he: 'לדבר עם נציג', en: 'Talk to a person', ru: 'Связаться с человеком', fr: 'Parler à une personne' },
} satisfies Record<string, T>;

const tool = {
  planner: (l: L) => card('tool', { he: 'מתכנן המטבח', en: 'Kitchen planner', ru: 'Планировщик кухни', fr: 'Planificateur' }[l], { he: 'הזינו מידות וקבלו תכנון בתלת-ממד.', en: 'Enter your dimensions, get a 3D layout.', ru: 'Введите размеры и получите 3D-план.', fr: 'Vos dimensions, un plan en 3D.' }[l], '/planner'),
  visualiser: (l: L, col?: string) => card('tool', { he: 'המטבח שלכם, באביבי', en: 'Your kitchen, in Avivi', ru: 'Ваша кухня в Avivi', fr: 'Votre cuisine, en Avivi' }[l], { he: 'מעלים תמונה, רואים את החלל בקולקציה.', en: 'Upload a photo, see your space in a collection.', ru: 'Загрузите фото и увидьте своё пространство.', fr: 'Une photo, votre espace dans une collection.' }[l], col ? `/visualiser?collection=${col}` : '/visualiser'),
  book: (l: L) => card('handoff', { he: 'תיאום ביקור באולם', en: 'Book a showroom visit', ru: 'Запись в салон', fr: 'Réserver une visite' }[l], { he: 'מעצב יראה את מה שצירפתם לפני הפגישה.', en: 'A designer sees what you attach before the meeting.', ru: 'Дизайнер увидит вложения до встречи.', fr: 'Le designer voit vos pièces jointes avant le rendez-vous.' }[l], '/book'),
  smart: (l: L) => card('page', 'SMART KITCHEN', { he: 'חמשת העקרונות, נפתחים בתלת-ממד.', en: 'The five principles, opened in 3D.', ru: 'Пять принципов в 3D.', fr: 'Les cinq principes, en 3D.' }[l], '/smart-kitchen'),
  collection: (l: L, id: string, name: string) => card('collection', name, { he: 'לעמוד הקולקציה', en: 'Open the collection', ru: 'Открыть коллекцию', fr: 'Voir la collection' }[l], `/collections/${id}`),
  page: (title: string, text: string, path: string) => card('page', title, text, path),
  list: (title: string, items: string[]) => card('checklist', title, '', '', items),
};

const CARE: Intent = {
  id: 'care',
  match: rx('\\bclean|\\bcare\\b|look after|maintain|maintenance|\\bstains?\\b|scratch|\\bseal', 'ניקוי|לנקות|מנקים|לשמור על|שומרים על|תחזוקה|כתם|כתמים|שריטה|שריטות', 'уход|ухаживать|чистить|чистка|пятн|царапин', 'entretenir|entretien|nettoy|tache|rayure'),
  reply: {
    he: 'כהמלצה כללית: שיש אוהב שמנגבים מהר כתמים חומציים כמו לימון או יין, עם חומר ניקוי בעל pH ניטרלי, ואיטום לפי המלצת הספק. אבן וקוורץ מסתפקים במים חמים וחומר עדין, ותחתית חמה מתחת לסיר חם. תמיד פעלו לפי הוראות הטיפול שמצורפות למשטח.',
    en: 'As general advice: marble wants acidic spills like lemon or wine wiped quickly, a pH-neutral cleaner, and sealing as the supplier advises. Stone and quartz need warm water and a mild cleaner, and a trivet under hot pots. Always follow the care instructions supplied with your surface.',
    ru: 'Общие советы: с мрамора быстро вытирайте кислое — лимон, вино; используйте pH-нейтральное средство и пропитку по рекомендации поставщика. Камню и кварцу достаточно тёплой воды и мягкого средства, под горячую посуду — подставку. Всегда следуйте инструкции к вашей столешнице.',
    fr: 'Conseils généraux : sur le marbre, essuyez vite l’acide (citron, vin), utilisez un nettoyant au pH neutre et imprégnez selon le fournisseur. Pierre et quartz : eau tiède, nettoyant doux, dessous-de-plat sous les casseroles chaudes. Suivez toujours les instructions fournies.',
  },
  cards: (l) => [tool.page({ he: 'מדריכי טיפול', en: 'Care guides', ru: 'Уход', fr: 'Guides d’entretien' }[l], { he: 'פורניר, לכה, שיש, אבן וקוורץ.', en: 'Veneer, lacquer, marble, stone and quartz.', ru: 'Шпон, лак, мрамор, камень, кварц.', fr: 'Placage, laque, marbre, pierre, quartz.' }[l], '/service'), tool.page({ he: 'משטחים ומוצרים', en: 'Surfaces & products', ru: 'Столешницы', fr: 'Plans et produits' }[l], { he: 'מבחר משטחי שיש ואבן.', en: 'Marble and stone surfaces.', ru: 'Мрамор и камень.', fr: 'Marbre et pierre.' }[l], '/products')],
  suggest: [S.veneer, S.dark],
};

const CARE_NOUNS = rx('marble|quartz|\\bstone|countertop|worktop|surface', `(?:^|[^${HE_L}])[הבמ]שיש(?![${HE_L}])`, '(?:על|משטח|משטחי|ניקוי)\\s?שיש|^שיש|קוורץ|קיסר|משטח', hw('אבן|אבנים'), 'мрамор|кварц|камен|столешниц', 'marbre|quartz|pierre|plan de travail');

const INTENTS: Intent[] = [
  {
    id: 'identity',
    match: rx('which (?:ai|model)|what (?:ai|model)|who (?:made|built|created|are) you|what are you\\?|are you (?:a )?(?:bot|robot|ai|human|real person)|chat\\s?gpt|claude|open\\s?ai|anthropic|\\bgpt\\b|gemini|language model', 'איזה מודל|מי אתה|מי בנה אותך|בינה מלאכותית', hw('בוט'), 'кто ты|ты кто|какая модель|ты бот|нейросет|искусственный интеллект', 'qui es-tu|quel modèle|es-tu un robot|intelligence artificielle'),
    reply: {
      he: 'אני המעצב של אביבי, עוזר התכנון באתר של אביבי מטבחים. אני עוזר בתכנון, בחומרים, באחסון ובהכנה לביקור באולם, ובכל רגע אפשר לעבור לנציג אנושי.',
      en: 'I’m Avivi Designer, the design assistant on the Avivi Kitchens website. I help with layouts, materials, storage and preparing your showroom visit, and a person can take over at any moment.',
      ru: 'Я Avivi Designer, помощник по дизайну на сайте Avivi Kitchens. Помогаю с планировкой, материалами, хранением и подготовкой к визиту в салон, а в любой момент можно перейти к живому сотруднику.',
      fr: 'Je suis Avivi Designer, l’assistant de conception du site Avivi Kitchens. J’aide pour les plans, les matériaux, le rangement et la préparation de votre visite, et une personne peut prendre le relais à tout moment.',
    },
    cards: (l) => [tool.planner(l), tool.book(l)],
    suggest: [S.small, S.bring, S.human],
  },
  {
    id: 'human',
    match: rx('human|\\bperson\\b|real person|representative|call me|\\bagent\\b|speak to someone|talk to someone', hw('נציג|נציגה|בן אדם|אדם אמיתי'), 'לדבר עם|תתקשרו|שיחה עם', 'человек|оператор|позвоните|менеджер|консультант', 'humain|personne|conseill|appelez|parler à'),
    reply: {
      he: 'בשמחה. נציג של אביבי ימשיך מכאן: אפשר לחייג, לכתוב בוואטסאפ או לתאם ביקור באולם תצוגה. מה שכתבתם כאן יעבור איתכם.',
      en: 'Of course. A person from Avivi will take it from here: call, write on WhatsApp, or book a showroom visit. What you wrote here goes with you.',
      ru: 'Конечно. Сотрудник Avivi продолжит разговор: позвоните, напишите в WhatsApp или запишитесь в салон. Ваш запрос передадим вместе с вами.',
      fr: 'Bien sûr. Une personne d’Avivi prend le relais : appelez, écrivez sur WhatsApp ou réservez une visite. Ce que vous avez écrit ici vous suit.',
    },
    cards: (l) => [tool.book(l)],
    suggest: [S.bring, S.showroom],
    handoff: true,
  },
  {
    id: 'price',
    match: rx('price|\\bcost|budget|how much|\\bquote', 'מחיר|עלות|תקציב|כמה עולה|כמה זה עולה|הצעת מחיר', cw('цена|цены|цену|цене|ценник|ценам'), 'стоимост|бюджет|сколько стоит|сколько будет стоить', 'prix|co[uû]t|combien (?:ça )?co[uû]te|devis|tarif'),
    reply: {
      he: 'את המחיר האמיתי נותן מעצב, לפי התכנון, החומרים והמכשירים, ואני לא ממציא מספרים. במתכנן המטבח תמצאו טווח מחירים לדוגמה, להתמצאות בלבד. הצעת מחיר מדויקת מקבלים בפגישה באולם התצוגה.',
      en: 'A real price comes from a designer, based on the layout, materials and appliances, and I won’t invent numbers. The kitchen planner shows an example price range, for orientation only. An exact quote comes from a showroom meeting.',
      ru: 'Реальную цену называет дизайнер — по планировке, материалам и технике; я не придумываю цифры. В планировщике есть пример диапазона цен, только для ориентира. Точное предложение — на встрече в салоне.',
      fr: 'Le vrai prix vient d’un designer, selon l’agencement, les matériaux et les appareils, et je n’invente pas de chiffres. Le planificateur affiche une fourchette d’exemple, pour s’orienter. Le devis exact se fait en showroom.',
    },
    cards: (l) => [tool.planner(l), tool.book(l)],
    suggest: [S.bring, S.small],
    handoff: true,
  },
  {
    id: 'timing',
    match: rx('lead time|delivery|how long|when will|warranty|guarantee|how soon', 'זמן אספקה|זמני אספקה|כמה זמן|מתי (?:יגיע|תגיע|אקבל|מקבלים)|אחריות', 'срок|гаранти|когда привез|сколько времени|как долго|сколько ждать', 'délai|garantie|combien de temps'),
    reply: {
      he: 'זמני אספקה ותנאי אחריות מאשרת אביבי עבור כל פרויקט, ולכן לא אנחש אותם. נציג יכול לענות על זה בדיוק. בעמוד השירות יש גם מדריכי טיפול כלליים.',
      en: 'Lead times and warranty terms are confirmed by Avivi for each project, so I won’t guess them. A person can answer exactly. The service page also has general care guides.',
      ru: 'Сроки и условия гарантии Avivi подтверждает для каждого проекта, поэтому я не буду гадать. Точный ответ даст сотрудник. На странице сервиса есть общие советы по уходу.',
      fr: 'Les délais et la garantie sont confirmés par Avivi pour chaque projet : je ne vais pas les deviner. Une personne peut répondre précisément. La page service propose aussi des conseils d’entretien.',
    },
    cards: (l) => [tool.book(l), tool.page({ he: 'שירות ואחריות', en: 'Service & warranty', ru: 'Сервис и гарантия', fr: 'Service et garantie' }[l], { he: 'בקשת שירות ומדריכי טיפול.', en: 'Service requests and care guides.', ru: 'Заявки и уход.', fr: 'Demandes et entretien.' }[l], '/service')],
    suggest: [S.marble, S.process],
    handoff: true,
  },
  {
    id: 'architect',
    match: rx('architect|interior design|technical|spec sheet|\\bcad\\b|\\bdwg\\b|\\bdxf\\b|\\bbim\\b|swatch|\\bbulk\\b|tender', 'אדריכל|מעצב פנים|מעצבת פנים|מעצבי פנים|דף טכני|דפים טכניים|קבצים|דוגמית|דוגמיות', 'архитект|дизайнер интерьер|дизайнеру интерьер|технич|образц', 'architecte|fiches? techniques?|échantillon|décorat'),
    reply: {
      he: 'לאדריכלים ומעצבי פנים יש אזור מקצועי: ספריית חומרים עם דוגמיות, דף טכני ובלוקים ל-CAD (בקונספט הזה הקבצים הם לדוגמה). אפשר לרשום פרויקט ולעבוד מול איש קשר מקצועי אחד.',
      en: 'Architects and interior designers have a professional area: a material library with swatches, a technical sheet and CAD blocks (example files in this concept). Register a project and work with one professional contact.',
      ru: 'Для архитекторов и дизайнеров есть профессиональный раздел: библиотека материалов с образцами, технический лист и CAD-блоки (в концепции — файлы-примеры). Зарегистрируйте проект и работайте с одним контактом.',
      fr: 'Les architectes et architectes d’intérieur ont leur espace : bibliothèque de matériaux, fiche technique et blocs CAO (fichiers d’exemple dans ce concept). Enregistrez un projet et travaillez avec un seul interlocuteur.',
    },
    cards: (l) => [tool.page({ he: 'אדריכלים וקבלנים', en: 'Architects & contractors', ru: 'Архитекторам и подрядчикам', fr: 'Architectes et promoteurs' }[l], { he: 'הורדות, רישום פרויקט, פניות.', en: 'Downloads, project registration, inquiries.', ru: 'Файлы, регистрация, запросы.', fr: 'Téléchargements, projets, demandes.' }[l], '/professionals')],
    suggest: [S.veneer, S.showroom],
  },
  {
    id: 'developer',
    match: rx('developer|new apartment|new flat|new build|handover|standard kitchen|contractor kitchen', 'קבלן|דירה חדשה|דירת קבלן|מסירה|מטבח סטנדרט', 'застройщик|новостро|новая квартира|новой квартир', 'promoteur|appartement neuf|logement neuf|livraison'),
    reply: {
      he: 'קיבלתם מטבח סטנדרטי מהקבלן? כדאי לברר מוקדם מה המועד האחרון לשינויים, ולהביא את תוכנית הדירה והמפרט. הזיכוי והתיאום מול הקבלן משתנים מפרויקט לפרויקט, ואביבי בודקת מה חל אצלכם. ההתקנה מתוזמנת למסירה.',
      en: 'Received a standard kitchen from the developer? Ask early about the deadline for changes, and bring the apartment plan and the specification. Credit and coordination with the developer vary by project; Avivi checks what applies to yours. Installation is timed to your handover.',
      ru: 'Получили стандартную кухню от застройщика? Заранее узнайте крайний срок изменений и возьмите план квартиры и спецификацию. Зачёт и согласование зависят от проекта — Avivi проверит, что применимо к вашему. Монтаж приурочен к сдаче.',
      fr: 'Vous avez reçu une cuisine standard du promoteur ? Renseignez-vous tôt sur la date limite des modifications, et apportez le plan et le descriptif. L’avoir et la coordination varient selon le projet ; Avivi vérifie ce qui s’applique. La pose est calée sur la livraison.',
    },
    cards: (l) => [tool.page({ he: 'שדרוג מטבח קבלן', en: 'Developer kitchen upgrade', ru: 'Апгрейд кухни застройщика', fr: 'Cuisine du promoteur' }[l], { he: 'התהליך בקווים כלליים, ותיאום פגישה.', en: 'The process in general terms, and a meeting.', ru: 'Процесс и запись на встречу.', fr: 'Le processus et un rendez-vous.' }[l], '/new-apartment'), tool.book(l)],
    suggest: [S.bring, S.price],
  },
  {
    id: 'renovation',
    match: rx('renovat|old apartment|old kitchen|replace (?:my|the|our) kitchen|remodel|refurbish', 'שיפוץ|שיפוצ|לשפץ|להחליף (?:את ה)?מטבח', hw('ישן|ישנה|ישנים|ישנות'), 'ремонт|замен', cw('стар(?:ая|ой|ую|ый|ом|ых|ые)'), 'rénov|ancien|remplacer'),
    reply: {
      he: 'בשיפוץ, מתחילים מהעובדות: מידות כל קיר, גובה התקרה, ואיפה המים, הגז והחשמל. אם מזיזים כיור או כיריים, זה משפיע על האינסטלציה. צלמו כל קיר, העלו תמונה להדמיה, ובואו עם זה לאולם התצוגה.',
      en: 'A renovation starts with the facts: every wall’s length, the ceiling height, and where the water, gas and power points are. Moving the sink or hob affects the plumbing. Photograph each wall, upload one to the visualiser, and bring it to the showroom.',
      ru: 'Ремонт начинается с фактов: длина каждой стены, высота потолка, где вода, газ и электричество. Перенос мойки или плиты затрагивает коммуникации. Сфотографируйте каждую стену, загрузите фото в визуализатор и приходите с ним в салон.',
      fr: 'Une rénovation commence par les faits : longueur de chaque mur, hauteur sous plafond, arrivées d’eau, de gaz et d’électricité. Déplacer l’évier ou la plaque touche la plomberie. Photographiez chaque mur, testez le visualiseur, et venez en showroom.',
    },
    cards: (l) => [tool.visualiser(l), tool.list({ he: 'לפני השיפוץ', en: 'Before you renovate', ru: 'Перед ремонтом', fr: 'Avant de rénover' }[l], [{ he: 'מידות כל קיר וגובה תקרה', en: 'Wall lengths and ceiling height', ru: 'Длины стен и высота потолка', fr: 'Longueurs des murs et hauteur' }[l], { he: 'נקודות מים, גז וחשמל', en: 'Water, gas and power points', ru: 'Вода, газ, электричество', fr: 'Eau, gaz, électricité' }[l], { he: 'תמונה של כל קיר', en: 'A photo of each wall', ru: 'Фото каждой стены', fr: 'Une photo de chaque mur' }[l], { he: 'רשימת מכשירים', en: 'Your appliance list', ru: 'Список техники', fr: 'La liste des appareils' }[l]]), tool.book(l)],
    suggest: [S.small, S.bring],
  },
  {
    id: 'small',
    match: rx('small|compact|tiny|studio|narrow|tel ?aviv', hw('קטן|קטנה|קטנים|קטנטן|צר|צרה|צרים'), 'קומפקט|תל אביב|סטודיו|דירת חדר', 'маленьк|компакт|узк|тель-авив|небольш', 'petit|compact|étroit|tel-aviv'),
    reply: {
      he: 'במטבח קטן, כל סנטימטר צריך תפקיד. כך עובדים עקרונות SMART KITCHEN: ארונות גבוהים עד התקרה, מגירות עמוקות במקום דלתות, פתרון לפינה ומגירת צוקל. בדרך כלל מטבח ישר או L עובד הכי טוב. נסו את המידות שלכם במתכנן.',
      en: 'In a small kitchen, every centimetre needs a job. That’s SMART KITCHEN: tall units to the ceiling, deep drawers instead of doors, a corner solution and a plinth drawer. A straight run or an L usually works best. Try your own dimensions in the planner.',
      ru: 'В маленькой кухне у каждого сантиметра должна быть работа. Это принципы SMART KITCHEN: высокие шкафы до потолка, глубокие ящики вместо дверей, угловое решение и цокольный ящик. Обычно лучше всего прямая или угловая планировка. Попробуйте свои размеры в планировщике.',
      fr: 'Dans une petite cuisine, chaque centimètre doit servir. C’est SMART KITCHEN : colonnes jusqu’au plafond, tiroirs profonds plutôt que portes, solution d’angle, tiroir de socle. Une cuisine linéaire ou en L fonctionne souvent le mieux. Essayez vos dimensions dans le planificateur.',
    },
    cards: (l) => [tool.planner(l), tool.smart(l), tool.collection(l, 'light', 'Light')],
    suggest: [S.veneer, S.lighting, S.bring],
  },
  CARE,
  {
    id: 'dark',
    match: rx('dark|black|graphite|walnut|evening', 'כהה|כהים|שחור|גרפיט|אגוז', 'тёмн|темн|черн|графит|орех', 'sombre|noir|graphite|noyer'),
    reply: {
      he: 'קולקציית Dark נבנתה בשביל אור הערב: לכה בגוון גרפיט, פורניר אגוז ואבן כהה עם עורקים בהירים. מדפים פתוחים עם תאורה נסתרת מחליפים ארונות עליונים. תאורה חמה מתחת לארונות ובמדפים עושה את ההבדל. רוצים לראות את המטבח שלכם בכהה?',
      en: 'The Dark collection is made for evening light: graphite lacquer, walnut veneer and dark stone with light veins. Open shelves with concealed light replace wall units. Warm light under the cabinets and along the shelves makes the difference. Want to see your own kitchen in Dark?',
      ru: 'Коллекция Dark создана для вечернего света: графитовый лак, шпон ореха и тёмный камень со светлыми прожилками. Открытые полки со скрытой подсветкой вместо верхних шкафов. Тёплый свет под шкафами и на полках решает всё. Хотите увидеть свою кухню в Dark?',
      fr: 'La collection Dark est faite pour la lumière du soir : laque graphite, placage noyer, pierre sombre aux veines claires. Des étagères ouvertes éclairées remplacent les meubles hauts. Une lumière chaude sous les meubles change tout. Voir votre cuisine en Dark ?',
    },
    cards: (l) => [tool.collection(l, 'dark', 'Dark'), tool.visualiser(l, 'dark')],
    suggest: [S.lighting, S.marble, S.bring],
  },
  {
    id: 'light',
    match: rx('\\bwhite\\b|bright|airy|\\bpale\\b|scandi|light (?:kitchen|colou?rs?|wood|oak|tones?)', hw('לבן|לבנה|לבנים|לבנות|בהיר|בהירה|בהירים|בהירות'), 'אוורירי', 'светл', cw('бел(?:ая|ый|ой|ую|ые|ых|ом)'), lw('blanc|blanche|blancs|blanches|claire?s?|lumineu(?:x|se)')),
    reply: {
      he: 'קולקציית Light בנויה סביב אור: לכה בגוון לבן-עצם, אלון בהיר, קוורץ לבן וידיות מוט דקות. היא מרחיבה חלל קטן ומחזירה את אור היום. מדפים פתוחים מאלון מוסיפים חום. רוצים לראות את המטבח שלכם בבהיר?',
      en: 'The Light collection is built around light: bone-white lacquer, pale oak, white quartz and slim bar handles. It opens up a small room and gives back the daylight. Open oak shelves add warmth. Want to see your own kitchen in Light?',
      ru: 'Коллекция Light построена вокруг света: тёплый белый лак, светлый дуб, белый кварц и тонкие ручки-рейлинги. Она раскрывает небольшое пространство и возвращает дневной свет. Открытые дубовые полки добавляют тепла. Хотите увидеть свою кухню в Light?',
      fr: 'La collection Light est pensée pour la lumière : laque blanc os, chêne clair, quartz blanc, fines poignées barres. Elle ouvre une petite pièce et rend la lumière du jour. Des étagères en chêne apportent de la chaleur. Voir votre cuisine en Light ?',
    },
    cards: (l) => [tool.collection(l, 'light', 'Light'), tool.visualiser(l, 'light')],
    suggest: [S.small, S.veneer, S.bring],
  },
  {
    id: 'classic',
    match: rx('provence|classic|shaker|country|framed', 'פרובנס|קלאסי|כפרי|ממוסגר', 'прованс|классик|кантри|рамочн', 'proven[cç]|classique|campagne'),
    reply: {
      he: 'קולקציית Classic מביאה קלאסי ופרובנס בדיוק של היום: חזיתות ממוסגרות, כרכובים, כפתורי פליז ומשטחי שיש. מאחורי החזיתות יש אחסון מודרני לגמרי. אריחים במראה עבודת יד ומדפים פתוחים משלימים את הסגנון.',
      en: 'The Classic collection brings classic and Provence with today’s precision: framed fronts, cornices, brass knobs and marble surfaces. Behind the fronts, the storage is fully modern. Handmade-look tiles and open shelves complete the look.',
      ru: 'Коллекция Classic — классика и прованс с сегодняшней точностью: рамочные фасады, карнизы, латунные кнопки и мрамор. За фасадами — полностью современное хранение. Плитка «ручной работы» и открытые полки завершают стиль.',
      fr: 'La collection Classic apporte le classique et le provençal avec la précision d’aujourd’hui : façades à cadre, corniches, boutons en laiton, marbre. Derrière les façades, un rangement résolument moderne. Carreaux d’aspect artisanal et étagères ouvertes complètent le style.',
    },
    cards: (l) => [tool.collection(l, 'classic', 'Classic'), tool.visualiser(l, 'classic')],
    suggest: [S.marble, S.island, S.bring],
  },
  {
    id: 'modern',
    match: rx('modern|handleless|minimal', 'מודרני|בלי ידיות|ללא ידיות|מינימליסט', 'современн|без ручек|минимал|модерн', 'moderne|sans poignée|minimal'),
    reply: {
      he: 'קולקציית Modern היא שקט של קווים: חזיתות בלי ידיות, לכה מט, פורניר אלון טבעי ואבן בגימור מט. מכשירי החשמל נעלמים מאחורי חזיתות, כמו בעיצוב הנקי של SMART KITCHEN. רוצים לראות את המטבח שלכם במודרני?',
      en: 'The Modern collection is quiet lines: handleless fronts, matte lacquer, natural oak veneer and honed stone. Appliances disappear behind fronts, as in SMART KITCHEN’s clean design. Want to see your own kitchen in Modern?',
      ru: 'Коллекция Modern — спокойные линии: фасады без ручек, матовый лак, натуральный шпон дуба и матовый камень. Техника скрыта за фасадами, как в чистом дизайне SMART KITCHEN. Хотите увидеть свою кухню в Modern?',
      fr: 'La collection Modern, ce sont des lignes calmes : façades sans poignées, laque mate, placage chêne naturel, pierre adoucie. L’électroménager disparaît derrière les façades, comme dans le design épuré de SMART KITCHEN. Voir votre cuisine en Modern ?',
    },
    cards: (l) => [tool.collection(l, 'modern', 'Modern'), tool.visualiser(l, 'modern'), tool.smart(l)],
    suggest: [S.veneer, S.island, S.bring],
  },
  {
    id: 'specials',
    match: rx('special|fluted|olive|travertine', 'ספיישל|מחורץ|זית|טרוורטין|סדרה מיוחדת', 'спешл|рифлён|рифлен|олив|травертин', 'spécial|cannel|olive|travertin'),
    reply: {
      he: 'Avivi Specials היא סדרה מתחלפת. בקונספט הזה: אלון מחורץ, ירוק זית עמוק וטרוורטין. פרטי הסדרה הנוכחית מאושרים באולם התצוגה. רוצים לראות אותה על המטבח שלכם?',
      en: 'Avivi Specials is a changing series. In this concept: fluted oak, deep olive and travertine. Details of the current series are confirmed in the showroom. Want to see it on your own kitchen?',
      ru: 'Avivi Specials — сменная серия. В этой концепции: рифлёный дуб, глубокий оливковый и травертин. Детали текущей серии уточняются в салоне. Хотите примерить её на свою кухню?',
      fr: 'Avivi Specials est une série qui change. Dans ce concept : chêne cannelé, olive profond et travertin. Les détails de la série actuelle se confirment en showroom. La voir sur votre cuisine ?',
    },
    cards: (l) => [tool.collection(l, 'specials', 'Avivi Specials'), tool.visualiser(l, 'specials'), tool.book(l)],
    suggest: [S.veneer, S.showroom, S.bring],
  },
  {
    id: 'island',
    match: rx('island|family|\\bkids\\b|children', hw('אי') + '(?! אפשר)', 'משפח|ילדים', 'остров|семейн', cw('семья|семьи|семьёй|семьей|семью|дети|детей|детьми|ребён[а-яё]*|ребен[а-яё]*'), 'îlot|famil|enfants'),
    reply: {
      he: 'אי משפחתי הוא מקום להתאסף. כהנחיה כללית, השאירו מעבר של 100–120 ס״מ בין האי לריצה, וכ-60 ס״מ של משטח לכל מקום ישיבה. לבית עם ילדים: משטחים עמידים, חזיתות קלות לניקוי ומגירות לכלים יומיומיים בגובה שלהם. בדקו במתכנן אם יש מקום לאי.',
      en: 'A family island is a place to gather. As a general guideline, keep 100–120 cm between the island and the run, and about 60 cm of counter per seat. With children: durable surfaces, easy-clean fronts, and everyday items in drawers at their height. Check in the planner whether your room fits an island.',
      ru: 'Остров — место, где собирается семья. По общему правилу оставьте 100–120 см между островом и линией и около 60 см столешницы на одно место. С детьми: прочные поверхности, легко моющиеся фасады и повседневные вещи в ящиках на их высоте. Проверьте в планировщике, поместится ли остров.',
      fr: 'Un îlot, c’est l’endroit où l’on se retrouve. En règle générale, gardez 100 à 120 cm entre l’îlot et le linéaire, et environ 60 cm de plan par assise. Avec des enfants : surfaces résistantes, façades faciles à nettoyer, objets du quotidien à leur hauteur. Vérifiez dans le planificateur si un îlot tient.',
    },
    cards: (l) => [tool.planner(l), tool.collection(l, 'modern', 'Modern'), tool.list({ he: 'אי, בקווים כלליים', en: 'Island, general guidelines', ru: 'Остров: общие правила', fr: 'Îlot : repères' }[l], [{ he: 'מעבר 100–120 ס״מ', en: 'Aisle 100–120 cm', ru: 'Проход 100–120 см', fr: 'Passage 100–120 cm' }[l], { he: 'כ-60 ס״מ לכל מקום ישיבה', en: 'About 60 cm per seat', ru: 'Около 60 см на место', fr: 'Environ 60 cm par assise' }[l], { he: 'מקום לעבור מאחורי הכיסאות', en: 'Room to pass behind the seats', ru: 'Место для прохода за стульями', fr: 'De la place derrière les assises' }[l]])],
    suggest: [S.lighting, S.price, S.bring],
  },
  {
    id: 'veneer',
    match: rx('veneer|lacquer|\\bwood|\\boak\\b|matte', 'פורניר|גימור', hw('לכה|עץ|אלון|מט'), 'шпон|дерев|дуб|матов', cw('лак|лака|лаком|лаки'), 'placage|laqu|\\bbois\\b|chêne', lw('mate?s?')),
    reply: {
      he: 'פורניר עץ טבעי הוא שכבה דקה של עץ אמיתי על ליבה יציבה: סיב שמרגישים, חזית שנשארת ישרה, והגוון מעמיק מעט עם השנים. לכה מט נותנת צבע שקט ואחיד. רבים משלבים: לכה בריצה ועץ בארונות הגבוהים או באי. פורניר עץ טבעי הוא חדשנות מובילה של SMART KITCHEN.',
      en: 'Natural wood veneer is a thin layer of real wood over a stable core: grain you can feel, a front that stays flat, and a tone that deepens a little over the years. Matte lacquer gives a calm, even colour. Many people combine them: lacquer on the run, wood on the tall units or the island. Natural wood veneer is a featured SMART KITCHEN innovation.',
      ru: 'Натуральный шпон — тонкий слой настоящего дерева на стабильной основе: ощутимая текстура, ровный фасад, оттенок с годами немного углубляется. Матовый лак даёт спокойный ровный цвет. Часто их сочетают: лак на линии, дерево на высоких шкафах или острове. Натуральный шпон — ключевая инновация SMART KITCHEN.',
      fr: 'Le placage bois naturel est une fine couche de vrai bois sur une âme stable : un fil qu’on sent, une façade qui reste plane, une teinte qui s’approfondit avec le temps. La laque mate donne une couleur calme. Beaucoup combinent : laque sur le linéaire, bois sur les colonnes ou l’îlot. Le placage naturel est une innovation phare de SMART KITCHEN.',
    },
    cards: (l) => [tool.page({ he: 'להרגיש את החומר', en: 'Feel the material', ru: 'Почувствуйте материал', fr: 'Sentir la matière' }[l], { he: 'גררו את האור על פני החומרים.', en: 'Drag the light across the surfaces.', ru: 'Ведите свет по поверхностям.', fr: 'Déplacez la lumière.' }[l], '/'), tool.page({ he: 'פורניר עץ טבעי, בגובה העיניים', en: 'Natural wood veneer, explained', ru: 'Натуральный шпон', fr: 'Le placage, expliqué' }[l], { he: 'כתבה מהמגזין (תוכן דמו).', en: 'Magazine article (demo content).', ru: 'Статья (демо).', fr: 'Article (démo).' }[l], '/magazine/natural-wood-veneer')],
    suggest: [S.marble, S.dark, S.small],
  },
  { ...CARE, match: CARE_NOUNS },
  {
    id: 'lighting',
    match: rx('\\blight(?:ing|s)?\\b|\\bleds?\\b|lamp|pendant|spotlight', 'תאורה|תאור|מנור|ספוט', hw('אור|לד|לדים'), 'свет|освещ|подсвет|светильн|ламп', 'éclairage|lumière|suspension|luminaire'),
    reply: {
      he: 'תאורה טובה בנויה בשכבות: אור עבודה מתחת לארונות העליונים, אור כללי מהתקרה, ואור הדגשה במדפים ובמגירות. לבן חם, בסביבות 2700–3000K, מרגיש בית, ודימר עוזר לעבור מבוקר לערב. מעל אי, מנורות תלויות יוצרות את המרכז.',
      en: 'Good lighting comes in layers: task light under the wall units, ambient light from the ceiling, and accent light in shelves and drawers. Warm white, around 2700–3000 K, feels like home, and dimmers carry you from morning to evening. Over an island, pendants set the centre.',
      ru: 'Хороший свет — это слои: рабочий под верхними шкафами, общий с потолка, акцентный на полках и в ящиках. Тёплый белый около 2700–3000 K ощущается по-домашнему, а диммер помогает перейти от утра к вечеру. Над островом центр задают подвесы.',
      fr: 'Un bon éclairage se construit en couches : lumière de travail sous les meubles hauts, lumière d’ambiance au plafond, accents dans les étagères et tiroirs. Un blanc chaud, vers 2700–3000 K, fait maison ; un variateur accompagne du matin au soir. Au-dessus d’un îlot, les suspensions donnent le centre.',
    },
    cards: (l) => [tool.list({ he: 'שלוש שכבות אור', en: 'Three layers of light', ru: 'Три слоя света', fr: 'Trois couches de lumière' }[l], [{ he: 'עבודה: מתחת לארונות', en: 'Task: under the wall units', ru: 'Рабочий: под шкафами', fr: 'Travail : sous les meubles' }[l], { he: 'כללי: תקרה, עם דימר', en: 'Ambient: ceiling, dimmable', ru: 'Общий: потолок, диммер', fr: 'Ambiance : plafond, variateur' }[l], { he: 'הדגשה: מדפים ומגירות', en: 'Accent: shelves and drawers', ru: 'Акцент: полки и ящики', fr: 'Accent : étagères et tiroirs' }[l]]), tool.collection(l, 'dark', 'Dark')],
    suggest: [S.dark, S.island],
  },
  {
    id: 'appliances',
    match: rx('appliance|\\boven|fridge|refrigerator|\\bhood\\b|extractor|dishwasher|\\bhobs?\\b|induction|microwave', 'מכשיר|תנור|מקרר|קולט|מדיח|כיריים|אינדוקציה|מיקרוגל', 'техник|духов|холодильн|вытяжк|посудомо|варочн|индукц|микроволн', 'appareil|électroménager|frigo|réfrigérateur|hotte|lave-vaisselle|plaque', lw('four|fours')),
    reply: {
      he: 'בעקרון העיצוב הנקי של SMART KITCHEN, המכשירים נעלמים: מקרר ומדיח מאחורי חזיתות, תנורים בגובה העיניים בעמודה, וארון מכשירים למכונת קפה וטוסטר. כהנחיה כללית, את קולט האדים ממקמים ומתקינים לפי הוראות היצרן. ספרו איזה מכשירים נשארים ואילו נקנים, זה קובע את המודולים.',
      en: 'In SMART KITCHEN’s clean design, appliances disappear: fridge and dishwasher behind fronts, ovens at eye level in a tall unit, and an appliance cabinet for the coffee machine and toaster. As a general guideline, the hood is sized and installed per the manufacturer’s instructions. Tell us which appliances you keep and which you buy; that decides the modules.',
      ru: 'В чистом дизайне SMART KITCHEN техника исчезает: холодильник и посудомойка за фасадами, духовки на уровне глаз в колонне, шкаф для кофемашины и тостера. Вытяжку подбирают и монтируют по инструкции производителя. Расскажите, какую технику оставляете и какую покупаете — от этого зависят модули.',
      fr: 'Avec le design épuré SMART KITCHEN, les appareils disparaissent : frigo et lave-vaisselle derrière des façades, fours à hauteur des yeux en colonne, armoire à appareils pour la machine à café. La hotte se dimensionne et se pose selon le fabricant. Dites-nous ce que vous gardez et ce que vous achetez : cela décide des modules.',
    },
    cards: (l) => [tool.smart(l), tool.page({ he: 'משטחים ומוצרים', en: 'Surfaces & products', ru: 'Продукты', fr: 'Produits' }[l], { he: 'מכשירים, כיורים ואביזרים.', en: 'Appliances, sinks and accessories.', ru: 'Техника, мойки, аксессуары.', fr: 'Appareils, éviers, accessoires.' }[l], '/products')],
    suggest: [S.small, S.bring],
  },
  {
    id: 'storage',
    match: rx('storage|\\bspace\\b|corner|drawer|pantry|organi[sz]|cupboard|cabinet', 'אחסון|פינה|פינתי|מגירה|מגירות|מזווה|לארגן|ארונות', hw('מקום|ארון'), 'хранен|угол|углов|ящик|кладов|органи|шкаф', cw('места|место'), 'rangement|espace|angle|tiroir|garde-manger|placard'),
    reply: {
      he: 'חיסכון במקום מבוזבז הוא העיקרון הראשון של SMART KITCHEN: פתרון פינה שמביא את העומק אליכם, מגירת צוקל, מזווה נשלף לכל הגובה, ומגירות עמוקות שרואים בהן הכול מלמעלה. בעמוד SMART KITCHEN המטבח נפתח ומראה כל מודול.',
      en: 'Saving wasted space is SMART KITCHEN’s first principle: a corner solution that brings the depth to you, a plinth drawer, a full-height pull-out pantry, and deep drawers you can see into from above. On the SMART KITCHEN page the kitchen opens to show each module.',
      ru: 'Экономия потерянного места — первый принцип SMART KITCHEN: угловое решение, цокольный ящик, выдвижная колонна-кладовая и глубокие ящики, где всё видно сверху. На странице SMART KITCHEN кухня открывается и показывает каждый модуль.',
      fr: 'Récupérer l’espace perdu est le premier principe SMART KITCHEN : solution d’angle, tiroir de socle, garde-manger coulissant pleine hauteur, tiroirs profonds où tout se voit d’en haut. Sur la page SMART KITCHEN, la cuisine s’ouvre module par module.',
    },
    cards: (l) => [tool.smart(l), tool.planner(l)],
    suggest: [S.small, S.veneer],
  },
  {
    id: 'bring',
    match: rx('bring|meeting|prepare|first visit|appointment', 'להביא|פגישה|להתכונן|להכין|ביקור', 'принести|взять|встреч|подготов|визит', 'apporter|rendez-vous|préparer|première visite'),
    reply: {
      he: 'פגישה ראשונה מתקדמת יותר כשהמעצב רואה את החלל. הביאו מידות של כל קיר וגובה תקרה, תמונה של כל קיר, את מיקום החלונות, הדלתות, המים והגז, רשימת מכשירים, ומה שכבר הכנתם כאן: הדמיה, תכנון או תקציר סגנון. צרפו אותם לתיאום הביקור.',
      en: 'A first meeting goes further when your designer can see the space. Bring each wall’s length and the ceiling height, a photo of every wall, where the windows, doors, water and gas are, your appliance list, and what you made here: a visualisation, a plan or a style brief. Attach them to the booking.',
      ru: 'Первая встреча продуктивнее, когда дизайнер видит пространство. Возьмите длины стен и высоту потолка, фото каждой стены, расположение окон, дверей, воды и газа, список техники и то, что вы сделали здесь: визуализацию, план или бриф. Прикрепите их к записи.',
      fr: 'Un premier rendez-vous va plus loin quand le designer voit l’espace. Apportez les longueurs des murs et la hauteur, une photo de chaque mur, l’emplacement des fenêtres, portes, eau et gaz, la liste des appareils, et ce que vous avez fait ici : visualisation, plan ou brief. Joignez-les à la réservation.',
    },
    cards: (l) => [tool.list({ he: 'מה להביא', en: 'What to bring', ru: 'Что взять', fr: 'Quoi apporter' }[l], [{ he: 'מידות קירות וגובה תקרה', en: 'Wall lengths, ceiling height', ru: 'Длины стен, высота потолка', fr: 'Murs et hauteur' }[l], { he: 'תמונה של כל קיר', en: 'A photo of every wall', ru: 'Фото каждой стены', fr: 'Une photo par mur' }[l], { he: 'חלונות, דלתות, מים וגז', en: 'Windows, doors, water, gas', ru: 'Окна, двери, вода, газ', fr: 'Fenêtres, portes, eau, gaz' }[l], { he: 'רשימת מכשירים', en: 'Appliance list', ru: 'Список техники', fr: 'Liste des appareils' }[l], { he: 'הדמיה, תכנון או תקציר', en: 'Visualisation, plan or brief', ru: 'Визуализация, план, бриф', fr: 'Visualisation, plan ou brief' }[l]]), tool.book(l)],
    suggest: [S.showroom, S.small],
  },
  {
    id: 'process',
    match: rx('process|\\bsteps\\b|how does it work|purchase|\\bbuy\\b|\\border\\b|\\bapps?\\b|smart (?:&|and) simple', 'תהליך|שלבים|איך זה עובד|רכישה|לקנות|הזמנה|אפליקציה', 'процесс|этап|как это работает|покупк|заказ|приложен', 'processus|étapes|comment ça marche|achat|commande', lw('appli|application')),
    reply: {
      he: 'בקווים כלליים: פגישת תכנון, מדידה, אישור, ייצור, אספקה והתקנה. את השלבים והתזמון המדויקים מאשרת אביבי. אפליקציית Avivi Smart & Simple, הראשונה מסוגה בשוק המטבחים בישראל, מנהלת את תהליך הרכישה מתחילתו ועד סופו.',
      en: 'In general terms: design meeting, measurement, approval, production, delivery and installation. Avivi confirms the exact steps and timing. The Avivi Smart & Simple app, the first of its kind in Israel’s kitchen market, manages the purchase process from start to finish.',
      ru: 'В общих чертах: встреча с дизайнером, замер, согласование, производство, доставка и монтаж. Точные шаги и сроки подтверждает Avivi. Приложение Avivi Smart & Simple — первое такого рода на кухонном рынке Израиля — ведёт покупку от начала до конца.',
      fr: 'En général : rendez-vous design, métré, validation, fabrication, livraison et pose. Avivi confirme les étapes et le calendrier exacts. L’application Avivi Smart & Simple, première de ce type sur le marché israélien, gère l’achat du début à la fin.',
    },
    cards: (l) => [tool.page({ he: 'האפליקציה', en: 'The app', ru: 'Приложение', fr: 'L’application' }[l], 'Avivi Smart & Simple', '/app'), tool.book(l)],
    suggest: [S.bring, S.price],
  },
  {
    id: 'showroom',
    match: rx('showroom|branch|\\bwhere\\b|address|opening hours|\\bhours\\b|\\bnear\\b|haifa|ashdod|herzliya|rishon|karmiel|bnei|kiryat', 'אולם|סניף|סניפים|איפה|כתובת|שעות|קרוב|חיפה|אשדוד|הרצליה|ראשון לציון|כרמיאל|בני ברק|בני דרום|קריית אתא', 'салон|филиал|адрес|часы работы|хайф|ашдод|герцли|ришон|кармиэл|кирьят', cw('где'), 'showroom|adresse|horaires|ouvert|haïfa|ashdod', lw('où')),
    reply: {
      he: 'יש שישה אולמות תצוגה: ראשון לציון, הרצליה פיתוח, בני ברק, בני דרום ליד אשדוד, כרמיאל וקריית אתא, החדש ביותר. את הכתובות ושעות הפתיחה המדויקות תמצאו בעמוד אולמות התצוגה; בקונספט הזה הן לדוגמה.',
      en: 'There are six showrooms: Rishon LeZion, Herzliya Pituach, Bnei Brak, Bnei Darom near Ashdod, Karmiel, and Kiryat Ata, the newest. Exact addresses and hours are on the showrooms page; in this concept they are examples.',
      ru: 'Шесть салонов: Ришон-ле-Цион, Герцлия-Питуах, Бней-Брак, Бней-Даром рядом с Ашдодом, Кармиэль и новейший — Кирьят-Ата. Точные адреса и часы — на странице салонов; в концепции это примеры.',
      fr: 'Six showrooms : Rishon LeZion, Herzliya Pituah, Bnei Brak, Bnei Darom près d’Ashdod, Karmiel et Kiryat Ata, le plus récent. Adresses et horaires sur la page des showrooms ; dans ce concept, ce sont des exemples.',
    },
    cards: (l) => [tool.page({ he: 'אולמות תצוגה', en: 'Showrooms', ru: 'Салоны', fr: 'Showrooms' }[l], { he: 'מפה, שעות לדוגמה, ניווט.', en: 'Map, example hours, directions.', ru: 'Карта, часы-пример, маршрут.', fr: 'Carte, horaires d’exemple, itinéraire.' }[l], '/showrooms'), tool.book(l)],
    suggest: [S.bring, S.process],
  },
];

const FALLBACK: Intent = {
  id: 'fallback',
  match: /.*/,
  reply: {
    he: 'אשמח לעזור. ספרו לי על החלל: גודל החדר, מי מבשל, ואיזה סגנון מרגיש לכם בית. אפשר גם להתחיל מכלי: הדמיה עם תמונה, מאתר הסגנון או מתכנן המטבח.',
    en: 'Happy to help. Tell me about the space: the room size, who cooks, and which style feels like home. You can also start with a tool: a visualisation from a photo, the style finder or the kitchen planner.',
    ru: 'С удовольствием помогу. Расскажите о пространстве: размер комнаты, кто готовит и какой стиль вам близок. Можно начать с инструмента: визуализация по фото, подбор стиля или планировщик.',
    fr: 'Avec plaisir. Parlez-moi de l’espace : la taille de la pièce, qui cuisine, le style qui vous ressemble. Vous pouvez aussi commencer par un outil : visualisation, style ou planificateur.',
  },
  cards: (l) => [tool.visualiser(l), tool.page({ he: 'מאתר הסגנון', en: 'Style finder', ru: 'Подбор стиля', fr: 'Trouver son style' }[l], { he: 'שמונה שאלות, שתי דקות.', en: 'Eight questions, two minutes.', ru: 'Восемь вопросов, две минуты.', fr: 'Huit questions, deux minutes.' }[l], '/style-finder'), tool.planner(l)],
  suggest: [S.small, S.island, S.bring],
};

/** Pick the language of the visitor's text, defaulting to the page locale. */
export function detectLang(text: string, fallback: L): L {
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  if (!/[a-z]/i.test(text)) return fallback;
  const fr = /[éèêàçùœâîôû]|\b(je|une?|le|la|les|des|du|de|ou|il|elle|cela|vous|mon|ma|mes|combien|cuisine|bonjour|comment|pour|avec|quel|quelle|est|parler)\b/i.test(text);
  const en = /\b(the|and|kitchen|how|what|my|is|do|does|i|with|for|should|can|to|an?|of|in|me|you|your|please|talk|need|want)\b/i.test(text);
  if (fr && !en) return 'fr';
  if (en && !fr) return 'en';
  return fallback === 'fr' || fallback === 'en' ? fallback : 'en';
}

const asLocale = (locale: string): L => (['he', 'en', 'ru', 'fr'].includes(locale) ? locale : 'he') as L;

/** The scripted intent a message maps to (first match wins, so order matters). */
export function matchIntent(text: string): string {
  return (INTENTS.find((i) => i.match.test(text)) ?? FALLBACK).id;
}

function build(intent: Intent, l: L): DesignerReply {
  return {
    reply: intent.reply[l],
    cards: intent.cards(l),
    suggestions: intent.suggest.filter(Boolean).map((s) => s[l]),
    handoff: !!intent.handoff,
    mode: 'demo',
  };
}

export function demoReply(text: string, locale: string): DesignerReply {
  const l = detectLang(text, asLocale(locale));
  return build(INTENTS.find((i) => i.match.test(text)) ?? FALLBACK, l);
}

/** A specific scripted answer in the page language (used for declines and busy moments). */
export function intentReply(id: string, locale: string): DesignerReply {
  return build(INTENTS.find((i) => i.id === id) ?? FALLBACK, asLocale(locale));
}

export const DEMO_INTENT_COUNT = INTENTS.length;

const DECLINE: T = {
  he: 'בזה לא אוכל לעזור כאן. נציג של אביבי ישמח להמשיך איתכם: אפשר לחייג, לכתוב בוואטסאפ או לתאם ביקור באולם תצוגה.',
  en: 'I can’t help with that one here. A person from Avivi will be glad to continue: call, write on WhatsApp, or book a showroom visit.',
  ru: 'С этим я здесь помочь не смогу. Сотрудник Avivi с радостью продолжит: позвоните, напишите в WhatsApp или запишитесь в салон.',
  fr: 'Je ne peux pas vous aider sur ce point ici. Une personne d’Avivi prendra volontiers le relais : appelez, écrivez sur WhatsApp ou réservez une visite.',
};

/** When the model declines a request: a polite handoff to a person, in the page language. */
export function declineReply(locale: string): DesignerReply {
  const l = asLocale(locale);
  const human = INTENTS.find((i) => i.id === 'human')!;
  return { reply: DECLINE[l], cards: human.cards(l), suggestions: human.suggest.map((s) => s[l]), handoff: true };
}
