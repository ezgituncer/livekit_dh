import type { LangCode } from '@/lib/i18n/translations';

/**
 * Suggested-question content: 5 categories, 5 questions each, localized in all
 * six UI languages (tr/en/ar/es/pt/ru). A missing key falls back to English.
 */
export type Localized = Record<LangCode, string>;

export interface SuggestedCategory {
  id: string;
  label: Localized;
  questions: Localized[]; // exactly 5
}

export const SUGGESTED_CATEGORIES: SuggestedCategory[] = [
  {
    id: 'culture',
    label: {
      tr: 'Türk Kültürü',
      en: 'Turkish Culture',
      ar: 'الثقافة التركية',
      es: 'Cultura turca',
      pt: 'Cultura turca',
      ru: 'Турецкая культура',
    },
    questions: [
      {
        tr: 'Türk toplumunda ailenin rolü nedir?',
        en: 'What is the role of family in Turkish society?',
        ar: 'ما هو دور الأسرة في المجتمع التركي؟',
        es: '¿Cuál es el papel de la familia en la sociedad turca?',
        pt: 'Qual é o papel da família na sociedade turca?',
        ru: 'Какова роль семьи в турецком обществе?',
      },
      {
        tr: 'Misafirperverlik Türk kültüründe neden bu kadar önemlidir?',
        en: 'Why is hospitality so important in Turkish culture?',
        ar: 'لماذا تحظى الضيافة بهذه الأهمية في الثقافة التركية؟',
        es: '¿Por qué la hospitalidad es tan importante en la cultura turca?',
        pt: 'Por que a hospitalidade é tão importante na cultura turca?',
        ru: 'Почему гостеприимство так важно в турецкой культуре?',
      },
      {
        tr: 'Nazar boncuğunun Türk kültüründeki önemi nedir?',
        en: 'What is the significance of the evil eye bead (nazar) in Turkish culture?',
        ar: 'ما أهمية خرزة العين (نَظَر) في الثقافة التركية؟',
        es: '¿Qué importancia tiene el amuleto del mal de ojo (nazar) en la cultura turca?',
        pt: 'Qual é a importância do amuleto contra o mau-olhado (nazar) na cultura turca?',
        ru: 'Какое значение имеет оберег от сглаза (назар) в турецкой культуре?',
      },
      {
        tr: 'Türkiye’de geleneksel müzik ve dans türleri nelerdir?',
        en: 'What are the traditional music and dance styles in Türkiye?',
        ar: 'ما هي أنواع الموسيقى والرقص التقليدية في تركيا؟',
        es: '¿Cuáles son los estilos tradicionales de música y danza en Türkiye?',
        pt: 'Quais são os estilos tradicionais de música e dança na Türkiye?',
        ru: 'Какие традиционные виды музыки и танцев есть в Турции?',
      },
      {
        tr: 'Türk çayının kültürel önemi nedir?',
        en: 'What is the cultural significance of Turkish tea?',
        ar: 'ما الأهمية الثقافية للشاي التركي؟',
        es: '¿Cuál es la importancia cultural del té turco?',
        pt: 'Qual é a importância cultural do chá turco?',
        ru: 'В чём культурное значение турецкого чая?',
      },
    ],
  },
  {
    id: 'cuisine',
    label: {
      tr: 'Türk Mutfağı',
      en: 'Turkish Cuisine',
      ar: 'المطبخ التركي',
      es: 'Cocina turca',
      pt: 'Culinária turca',
      ru: 'Турецкая кухня',
    },
    questions: [
      {
        tr: 'En popüler geleneksel Türk yemekleri nelerdir?',
        en: 'What are the most popular traditional Turkish dishes?',
        ar: 'ما هي أشهر الأطباق التركية التقليدية؟',
        es: '¿Cuáles son los platos tradicionales turcos más populares?',
        pt: 'Quais são os pratos tradicionais turcos mais populares?',
        ru: 'Какие самые популярные традиционные турецкие блюда?',
      },
      {
        tr: 'Geleneksel bir Türk kahvaltısında neler bulunur?',
        en: 'What is included in a traditional Turkish breakfast?',
        ar: 'ماذا يتضمن الفطور التركي التقليدي؟',
        es: '¿Qué incluye un desayuno turco tradicional?',
        pt: 'O que inclui um café da manhã turco tradicional?',
        ru: 'Что входит в традиционный турецкий завтрак?',
      },
      {
        tr: 'Menemenin ana malzemeleri nelerdir?',
        en: 'What are the main ingredients of menemen?',
        ar: 'ما هي المكونات الرئيسية للمنمن (menemen)؟',
        es: '¿Cuáles son los ingredientes principales del menemen?',
        pt: 'Quais são os principais ingredientes do menemen?',
        ru: 'Каковы основные ингредиенты менемена?',
      },
      {
        tr: 'Baklava nedir ve kökeni neresidir?',
        en: 'What is baklava and where does it originate?',
        ar: 'ما هي البقلاوة وما أصلها؟',
        es: '¿Qué es el baklava y cuál es su origen?',
        pt: 'O que é o baklava e qual é a sua origem?',
        ru: 'Что такое пахлава и каково её происхождение?',
      },
      {
        tr: 'Türk çayının günlük hayattaki önemi nedir?',
        en: 'What is the importance of Turkish tea in daily life?',
        ar: 'ما أهمية الشاي التركي في الحياة اليومية؟',
        es: '¿Qué importancia tiene el té turco en la vida diaria?',
        pt: 'Qual é a importância do chá turco no dia a dia?',
        ru: 'Какое значение имеет турецкий чай в повседневной жизни?',
      },
    ],
  },
  {
    id: 'history',
    label: {
      tr: 'Türk Tarihi',
      en: 'Turkish History',
      ar: 'التاريخ التركي',
      es: 'Historia turca',
      pt: 'História turca',
      ru: 'История Турции',
    },
    questions: [
      {
        tr: 'Malazgirt Savaşı (1071) nedir ve neden önemlidir?',
        en: 'What was the Battle of Manzikert (1071) and why is it important?',
        ar: 'ما هي معركة ملاذكرد (1071) ولماذا تُعدّ مهمة؟',
        es: '¿Qué fue la batalla de Manzikert (1071) y por qué es importante?',
        pt: 'O que foi a Batalha de Manziquerta (1071) e por que é importante?',
        ru: 'Что такое битва при Манцикерте (1071) и почему она важна?',
      },
      {
        tr: 'Selçukluların Anadolu kültürüne etkisi nedir?',
        en: 'What was the influence of the Seljuks on Anatolian culture?',
        ar: 'ما تأثير السلاجقة على ثقافة الأناضول؟',
        es: '¿Cuál fue la influencia de los selyúcidas en la cultura de Anatolia?',
        pt: 'Qual foi a influência dos seljúcidas na cultura da Anatólia?',
        ru: 'Каково влияние сельджуков на культуру Анатолии?',
      },
      {
        tr: 'Osmanlı İmparatorluğu nasıl kurulmuştur?',
        en: 'How was the Ottoman Empire founded?',
        ar: 'كيف تأسست الإمبراطورية العثمانية؟',
        es: '¿Cómo se fundó el Imperio otomano?',
        pt: 'Como o Império Otomano foi fundado?',
        ru: 'Как была основана Османская империя?',
      },
      {
        tr: 'Çanakkale Savaşı’nın önemi nedir?',
        en: 'What is the significance of the Battle of Gallipoli (Çanakkale)?',
        ar: 'ما أهمية معركة جناق قلعة (غاليبولي)؟',
        es: '¿Cuál es la importancia de la batalla de Galípoli (Çanakkale)?',
        pt: 'Qual é a importância da Batalha de Galípoli (Çanakkale)?',
        ru: 'В чём значение Галлиполийского сражения (Чанаккале)?',
      },
      {
        tr: 'Türkiye Cumhuriyeti ne zaman kurulmuştur?',
        en: 'When was the Republic of Türkiye founded?',
        ar: 'متى تأسست الجمهورية التركية؟',
        es: '¿Cuándo se fundó la República de Türkiye?',
        pt: 'Quando a República da Türkiye foi fundada?',
        ru: 'Когда была основана Турецкая Республика?',
      },
    ],
  },
  {
    id: 'festivals',
    label: {
      tr: 'Festivaller & Gelenekler',
      en: 'Festivals & Traditions',
      ar: 'المهرجانات والتقاليد',
      es: 'Festivales y tradiciones',
      pt: 'Festivais e tradições',
      ru: 'Праздники и традиции',
    },
    questions: [
      {
        tr: 'Şeker Bayramı gelenekleri nelerdir?',
        en: 'What are the traditions of Eid al-Fitr (Şeker Bayramı)?',
        ar: 'ما هي تقاليد عيد الفطر؟',
        es: '¿Cuáles son las tradiciones del Eid al-Fitr (Şeker Bayramı)?',
        pt: 'Quais são as tradições do Eid al-Fitr (Şeker Bayramı)?',
        ru: 'Каковы традиции праздника Рамазан-байрам (Шекер-байрам)?',
      },
      {
        tr: 'Kurban Bayramı gelenekleri nelerdir?',
        en: 'What are the traditions of the Feast of Sacrifice (Kurban Bayramı)?',
        ar: 'ما هي تقاليد عيد الأضحى؟',
        es: '¿Cuáles son las tradiciones del Eid al-Adha (Kurban Bayramı)?',
        pt: 'Quais são as tradições do Eid al-Adha (Kurban Bayramı)?',
        ru: 'Каковы традиции праздника Курбан-байрам?',
      },
      {
        tr: 'Türkiye’de Ulusal Egemenlik ve Çocuk Bayramı nasıl kutlanır?',
        en: "How is National Sovereignty and Children's Day celebrated in Türkiye?",
        ar: 'كيف يُحتفل بيوم السيادة الوطنية والطفل في تركيا؟',
        es: '¿Cómo se celebra el Día de la Soberanía Nacional y del Niño en Türkiye?',
        pt: 'Como o Dia da Soberania Nacional e da Criança é celebrado na Türkiye?',
        ru: 'Как в Турции отмечают День национального суверенитета и детей?',
      },
      {
        tr: 'Türkiye’de Aşure Günü’nde neler yapılır?',
        en: 'What is done on Ashura Day in Türkiye?',
        ar: 'ماذا يُفعل في يوم عاشوراء في تركيا؟',
        es: '¿Qué se hace el Día de Ashura en Türkiye?',
        pt: 'O que se faz no Dia de Ashura na Türkiye?',
        ru: 'Что делают в День Ашура в Турции?',
      },
      {
        tr: 'Geleneksel bir Türk düğünü nasıldır?',
        en: 'What is a traditional Turkish wedding like?',
        ar: 'كيف يكون حفل الزفاف التركي التقليدي؟',
        es: '¿Cómo es una boda turca tradicional?',
        pt: 'Como é um casamento turco tradicional?',
        ru: 'Какой бывает традиционная турецкая свадьба?',
      },
    ],
  },
  {
    id: 'places',
    label: {
      tr: 'Gezilecek Yerler',
      en: 'Places to Visit',
      ar: 'أماكن للزيارة',
      es: 'Lugares para visitar',
      pt: 'Lugares para visitar',
      ru: 'Места для посещения',
    },
    questions: [
      {
        tr: 'Ayasofya’nın tarihi önemi nedir?',
        en: 'What is the historical significance of Hagia Sophia?',
        ar: 'ما الأهمية التاريخية لآيا صوفيا؟',
        es: '¿Cuál es la importancia histórica de Santa Sofía?',
        pt: 'Qual é a importância histórica de Santa Sofia?',
        ru: 'В чём историческое значение собора Святой Софии (Айя-София)?',
      },
      {
        tr: 'Kapadokya nerededir ve neden ünlüdür?',
        en: 'Where is Cappadocia and why is it famous?',
        ar: 'أين تقع كابادوكيا ولماذا تشتهر؟',
        es: '¿Dónde está Capadocia y por qué es famosa?',
        pt: 'Onde fica a Capadócia e por que é famosa?',
        ru: 'Где находится Каппадокия и чем она знаменита?',
      },
      {
        tr: 'Pamukkale’yi popüler bir turistik nokta yapan nedir?',
        en: 'What makes Pamukkale a popular tourist destination?',
        ar: 'ما الذي يجعل باموكالي وجهة سياحية شهيرة؟',
        es: '¿Qué hace de Pamukkale un destino turístico popular?',
        pt: 'O que torna Pamukkale um destino turístico popular?',
        ru: 'Что делает Памуккале популярным туристическим местом?',
      },
      {
        tr: 'Topkapı Sarayı’nın Osmanlı tarihindeki önemi nedir?',
        en: 'What is the importance of Topkapı Palace in Ottoman history?',
        ar: 'ما أهمية قصر توبكابي في التاريخ العثماني؟',
        es: '¿Cuál es la importancia del Palacio de Topkapı en la historia otomana?',
        pt: 'Qual é a importância do Palácio de Topkapı na história otomana?',
        ru: 'Какое значение имеет дворец Топкапы в османской истории?',
      },
      {
        tr: 'Trabzon’daki Sümela Manastırı’nın özelliği nedir?',
        en: 'What is special about the Sümela Monastery in Trabzon?',
        ar: 'ما الذي يميّز دير سوميلا في طرابزون؟',
        es: '¿Qué tiene de especial el Monasterio de Sümela en Trabzon?',
        pt: 'O que há de especial no Mosteiro de Sümela em Trabzon?',
        ru: 'Чем особенен монастырь Сумела в Трабзоне?',
      },
    ],
  },
];
