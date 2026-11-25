import type { AgentDraft } from "./event-agent";
import { KINDS } from "./format";
import type { Locale } from "./i18n";

interface VenuePlan {
  venue: string;
  dress: string;
  bring: string[];
}

interface EventProfile {
  search: string;
  perGuest: number;
  ideas: Record<Locale, VenuePlan>;
}

// Editable planning allowances in tenge, before a venue or supplier is chosen.
const profiles: Record<(typeof KINDS)[number], EventProfile> = {
  "Тимбилдинг": {
    search: "коворкинг",
    perGuest: 5000,
    ideas: {
      ru: { venue: "Зал коворкинга с передвижными столами для командных заданий", dress: "Свободная одежда и удобная обувь", bring: ["Карточки с заданиями", "Маркеры и стикеры", "Вода и перекус"] },
      kk: { venue: "Топтық тапсырмаларға арналған, үстелдерін жылжытуға болатын коворкинг залы", dress: "Еркін киім және ыңғайлы аяқ киім", bring: ["Тапсырма карточкалары", "Маркерлер мен стикерлер", "Су мен тіскебасар"] },
      en: { venue: "A coworking room with movable tables for team activities", dress: "Casual clothes and comfortable shoes", bring: ["Activity cards", "Markers and sticky notes", "Water and snacks"] },
    },
  },
  "День рождения": {
    search: "кафе с банкетным залом",
    perGuest: 6000,
    ideas: {
      ru: { venue: "Отдельный зал кафе с местом для торта", dress: "Нарядная повседневная одежда", bring: ["Торт и свечи", "Открытка", "Украшения"] },
      kk: { venue: "Торт қоюға орны бар кафенің жеке залы", dress: "Сәнді күнделікті киім", bring: ["Торт пен шамдар", "Құттықтау ашықхаты", "Әшекейлер"] },
      en: { venue: "A private café room with space for a cake", dress: "Smart casual", bring: ["Cake and candles", "Birthday card", "Decorations"] },
    },
  },
  "Выезд на природу": {
    search: "зона для пикника",
    perGuest: 3000,
    ideas: {
      ru: { venue: "Площадка для пикника с навесом и столами", dress: "Одежда по погоде и закрытая обувь", bring: ["Пледы", "Питьевая вода", "Пакеты для мусора"] },
      kk: { venue: "Қалқасы мен үстелдері бар пикник алаңы", dress: "Ауа райына сай киім және жабық аяқ киім", bring: ["Жамылғылар", "Ауызсу", "Қоқыс пакеттері"] },
      en: { venue: "A picnic area with covered tables", dress: "Weather-appropriate layers and closed shoes", bring: ["Picnic blankets", "Drinking water", "Trash bags"] },
    },
  },
  "Настольные игры": {
    search: "клуб настольных игр",
    perGuest: 2500,
    ideas: {
      ru: { venue: "Антикафе с большим столом и хорошим освещением", dress: "Удобная повседневная одежда", bring: ["Настольные игры", "Блокнот для очков", "Перекус"] },
      kk: { venue: "Үлкен үстелі бар, жарық антикафе", dress: "Ыңғайлы күнделікті киім", bring: ["Үстел ойындары", "Ұпай жазатын дәптер", "Тіскебасар"] },
      en: { venue: "A board game café with a large, well-lit table", dress: "Comfortable casual clothes", bring: ["Board games", "Score pad", "Snacks"] },
    },
  },
  "Книжный клуб": {
    search: "библиотека",
    perGuest: 2000,
    ideas: {
      ru: { venue: "Тихая комната в библиотеке с местами для обсуждения", dress: "Повседневная одежда", bring: ["Книга", "Закладки", "Вопросы для обсуждения"] },
      kk: { venue: "Кітапханадағы талқылауға ыңғайлы тыныш бөлме", dress: "Күнделікті киім", bring: ["Кітап", "Бетбелгілер", "Талқылау сұрақтары"] },
      en: { venue: "A quiet library room with seating for discussion", dress: "Casual clothes", bring: ["The book", "Bookmarks", "Discussion questions"] },
    },
  },
  "Пробежка": {
    search: "парк",
    perGuest: 1000,
    ideas: {
      ru: { venue: "Вход в парк с круговой беговой дорожкой", dress: "Спортивная одежда и беговые кроссовки", bring: ["Бутылки с водой", "Полотенца"] },
      kk: { venue: "Айналма жүгіру жолы бар саябақтың кіреберісі", dress: "Спорттық киім және жүгіру аяқ киімі", bring: ["Су құтылары", "Сүлгілер"] },
      en: { venue: "The entrance to a park with a running loop", dress: "Running shoes and sportswear", bring: ["Water bottles", "Towels"] },
    },
  },
  "Вечеринка": {
    search: "аренда лофта",
    perGuest: 4000,
    ideas: {
      ru: { venue: "Лофт с местами для общения и общим столом", dress: "Свободный стиль", bring: ["Колонка и плейлист", "Напитки", "Закуски"] },
      kk: { venue: "Әңгімелесуге орны және ортақ үстелі бар лофт", dress: "Еркін стиль", bring: ["Дыбыс зорайтқыш пен әндер тізімі", "Сусындар", "Тіскебасар"] },
      en: { venue: "A loft with seating and a shared table", dress: "Casual attire", bring: ["Speaker and playlist", "Drinks", "Snacks"] },
    },
  },
};

export function suggestEventDetails(draft: AgentDraft, locale: Locale): AgentDraft {
  const kind = KINDS.find((value) => value === draft.kind) ?? "Вечеринка";
  const profile = profiles[kind];
  const ideas = profile.ideas[locale];
  return {
    ...draft,
    venueSearch: draft.venueSearch || [draft.location_name, draft.address].filter(Boolean).join(", ") || profile.search,
    location_name: draft.location_name || (draft.address ? "" : ideas.venue),
    dress_code: draft.dress_code.length ? draft.dress_code : [ideas.dress],
    bring: draft.bring.length ? draft.bring : ideas.bring,
    estimatePerGuest: draft.estimatePerGuest ?? profile.perGuest,
  };
}
