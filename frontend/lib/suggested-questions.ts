import type { LangCode } from '@/lib/i18n/translations';

/**
 * Orion Demo suggested questions: 5 categories, 5 questions each, localized in
 * all six UI languages (tr/en/ar/es/pt/ru). A missing key falls back to English.
 */
export type Localized = Record<LangCode, string>;

export interface SuggestedCategory {
  id: string;
  label: Localized;
  questions: Localized[]; // exactly 5
}

export const SUGGESTED_CATEGORIES: SuggestedCategory[] = [
  {
    id: 'getting-started',
    label: {
      tr: 'Başlangıç',
      en: 'Getting Started',
      ar: 'البدء',
      es: 'Primeros pasos',
      pt: 'Primeiros passos',
      ru: 'Начало работы',
    },
    questions: [
      {
        tr: 'Orion Demo nedir ve gerçek bir hizmet midir?',
        en: 'What is Orion Demo, and is it a real service?',
        ar: 'ما هو Orion Demo، وهل هو خدمة حقيقية؟',
        es: '¿Qué es Orion Demo y es un servicio real?',
        pt: 'O que é o Orion Demo e ele é um serviço real?',
        ru: 'Что такое Orion Demo и является ли он реальным сервисом?',
      },
      {
        tr: 'Orion Demo karşılama kitapçığının adı nedir?',
        en: 'What is the Orion Demo welcome booklet called?',
        ar: 'ما اسم كتيب الترحيب في Orion Demo؟',
        es: '¿Cómo se llama el folleto de bienvenida de Orion Demo?',
        pt: 'Como se chama o folheto de boas-vindas do Orion Demo?',
        ru: 'Как называется приветственный буклет Orion Demo?',
      },
      {
        tr: 'Orion Demo tanıtım oturumu nerede yapılır ve ne kadar sürer?',
        en: 'Where does Orion Demo orientation happen, and how long does it last?',
        ar: 'أين تُعقد الجلسة التعريفية في Orion Demo، وكم تستغرق؟',
        es: '¿Dónde se realiza la sesión de orientación de Orion Demo y cuánto dura?',
        pt: 'Onde acontece a sessão de orientação do Orion Demo e quanto tempo dura?',
        ru: 'Где проходит вводное занятие Orion Demo и сколько оно длится?',
      },
      {
        tr: 'Orion Demo için varışa ayrılan süre neden tanıtım oturumundan daha uzundur?',
        en: 'Why is the Orion Demo arrival slot longer than the orientation?',
        ar: 'لماذا تكون الفترة المخصصة للوصول في Orion Demo أطول من الجلسة التعريفية؟',
        es: '¿Por qué el tiempo reservado para la llegada a Orion Demo supera la duración de la orientación?',
        pt: 'Por que o período reservado para a chegada ao Orion Demo é maior que a duração da orientação?',
        ru: 'Почему время, отведённое на прибытие в Orion Demo, дольше вводного занятия?',
      },
      {
        tr: 'Orion Demo içinde hangi odalar grup atölyeleri ve sessiz alıştırmalar içindir?',
        en: 'Which Orion Demo rooms are for group workshops and quiet practice?',
        ar: 'ما الغرف المخصصة لورش العمل الجماعية والتدريب الهادئ في Orion Demo؟',
        es: '¿Qué salas de Orion Demo se usan para talleres grupales y prácticas tranquilas?',
        pt: 'Quais salas do Orion Demo são usadas para oficinas em grupo e prática silenciosa?',
        ru: 'Какие комнаты Orion Demo предназначены для групповых занятий и практики в тишине?',
      },
    ],
  },
  {
    id: 'access-trial',
    label: {
      tr: 'Erişim ve Deneme',
      en: 'Access & Trial',
      ar: 'الوصول والتجربة',
      es: 'Acceso y prueba',
      pt: 'Acesso e teste',
      ru: 'Доступ и пробный период',
    },
    questions: [
      {
        tr: 'Orion Demo etkinleştirme ifadesi nedir?',
        en: 'What is the Orion Demo activation phrase?',
        ar: 'ما عبارة التفعيل في Orion Demo؟',
        es: '¿Cuál es la frase de activación de Orion Demo?',
        pt: 'Qual é a frase de ativação do Orion Demo?',
        ru: 'Какая фраза используется для активации Orion Demo?',
      },
      {
        tr: 'Orion Demo deneme süresi ne kadardır ve ne zaman başlar?',
        en: 'How long is the Orion Demo trial, and when does it start?',
        ar: 'كم تستمر الفترة التجريبية في Orion Demo، ومتى تبدأ؟',
        es: '¿Cuánto dura el período de prueba de Orion Demo y cuándo comienza?',
        pt: 'Quanto dura o período de teste do Orion Demo e quando ele começa?',
        ru: 'Сколько длится пробный период Orion Demo и когда он начинается?',
      },
      {
        tr: 'Bir Orion Demo alıştırmasını tekrarlamak deneme süresini yeniden başlatır mı?',
        en: 'Does repeating an Orion Demo exercise restart the trial?',
        ar: 'هل تؤدي إعادة تمرين في Orion Demo إلى بدء الفترة التجريبية من جديد؟',
        es: '¿Repetir un ejercicio de Orion Demo reinicia el período de prueba?',
        pt: 'Repetir um exercício do Orion Demo reinicia o período de teste?',
        ru: 'Начинается ли пробный период Orion Demo заново при повторении упражнения?',
      },
      {
        tr: 'Orion Demo kılavuzunda deneme sonrası aylık ücret belirtiliyor mu?',
        en: 'Does the Orion Demo guide specify a monthly price after the trial?',
        ar: 'هل يحدد دليل Orion Demo سعرًا شهريًا بعد الفترة التجريبية؟',
        es: '¿La guía de Orion Demo indica un precio mensual después del período de prueba?',
        pt: 'O guia do Orion Demo informa um preço mensal após o período de teste?',
        ru: 'Указана ли в руководстве Orion Demo ежемесячная цена после пробного периода?',
      },
      {
        tr: 'Orion Demo katılımcısı neler yapabilir ve çalışma alanının bakımından kim sorumludur?',
        en: 'What can an Orion Demo participant do, and who maintains the workspace?',
        ar: 'ما الذي يمكن لمشارك في Orion Demo فعله، ومن يتولى صيانة مساحة العمل؟',
        es: '¿Qué puede hacer un participante de Orion Demo y quién mantiene el espacio de trabajo?',
        pt: 'O que um participante do Orion Demo pode fazer e quem mantém o espaço de trabalho?',
        ru: 'Что может делать участник Orion Demo и кто обслуживает рабочее пространство?',
      },
    ],
  },
  {
    id: 'practice-data',
    label: {
      tr: 'Alıştırmalar ve Veriler',
      en: 'Practice & Data',
      ar: 'التدريب والبيانات',
      es: 'Prácticas y datos',
      pt: 'Prática e dados',
      ru: 'Практика и данные',
    },
    questions: [
      {
        tr: 'Orion Demo alıştırma veri kümesinin adı nedir?',
        en: 'What is the Orion Demo practice dataset called?',
        ar: 'ما اسم مجموعة بيانات التدريب في Orion Demo؟',
        es: '¿Cómo se llama el conjunto de datos de práctica de Orion Demo?',
        pt: 'Como se chama o conjunto de dados de prática do Orion Demo?',
        ru: 'Как называется учебный набор данных Orion Demo?',
      },
      {
        tr: 'Orion Demo alıştırma verileri gerçek müşteri kayıtları içerir mi?',
        en: 'Does Orion Demo practice data contain real customer records?',
        ar: 'هل تحتوي بيانات التدريب في Orion Demo على سجلات عملاء حقيقيين؟',
        es: '¿Los datos de práctica de Orion Demo contienen registros de clientes reales?',
        pt: 'Os dados de prática do Orion Demo contêm registros de clientes reais?',
        ru: 'Содержат ли учебные данные Orion Demo записи о реальных клиентах?',
      },
      {
        tr: 'Standart Orion Demo klasör alıştırmasında kaç kayıt vardır?',
        en: 'How many records are in the standard Orion Demo folder exercise?',
        ar: 'كم سجلًا يوجد في تمرين المجلدات القياسي في Orion Demo؟',
        es: '¿Cuántos registros hay en el ejercicio estándar de carpetas de Orion Demo?',
        pt: 'Quantos registros há no exercício padrão de pastas do Orion Demo?',
        ru: 'Сколько записей в стандартном упражнении Orion Demo с папками?',
      },
      {
        tr: 'Orion Demo klasör alıştırmasındaki sayılar genel bir depolama sınırı mıdır?',
        en: 'Are the Orion Demo folder exercise counts a universal storage limit?',
        ar: 'هل تمثل أعداد المجلدات والسجلات في تمرين Orion Demo حدًا عامًا للتخزين؟',
        es: '¿Las cantidades del ejercicio de carpetas de Orion Demo son un límite general de almacenamiento?',
        pt: 'As quantidades do exercício de pastas do Orion Demo são um limite geral de armazenamento?',
        ru: 'Являются ли количества в упражнении Orion Demo с папками общим лимитом хранения?',
      },
      {
        tr: 'Orion Demo atölye eğitmeni ne yapar?',
        en: 'What does an Orion Demo workshop facilitator do?',
        ar: 'ما دور ميسّر ورشة العمل في Orion Demo؟',
        es: '¿Qué hace un facilitador de talleres de Orion Demo?',
        pt: 'O que faz um facilitador de oficinas do Orion Demo?',
        ru: 'Чем занимается ведущий практического занятия Orion Demo?',
      },
    ],
  },
  {
    id: 'support-booking',
    label: {
      tr: 'Destek ve Rezervasyon',
      en: 'Support & Booking',
      ar: 'الدعم والحجز',
      es: 'Soporte y reservas',
      pt: 'Suporte e reservas',
      ru: 'Поддержка и бронирование',
    },
    questions: [
      {
        tr: 'Orion Demo desteği hangi gün ve saatlerde verilir?',
        en: 'When is Orion Demo support available?',
        ar: 'متى يتوفر الدعم في Orion Demo؟',
        es: '¿Cuándo está disponible el soporte de Orion Demo?',
        pt: 'Quando o suporte do Orion Demo está disponível?',
        ru: 'Когда доступна поддержка Orion Demo?',
      },
      {
        tr: 'Orion Demo destek talebine hangi bilgileri eklemeliyim?',
        en: 'What details should I include in an Orion Demo support request?',
        ar: 'ما المعلومات التي ينبغي تضمينها في طلب دعم في Orion Demo؟',
        es: '¿Qué información debo incluir en una solicitud de soporte de Orion Demo?',
        pt: 'Quais informações devo incluir em uma solicitação de suporte do Orion Demo?',
        ru: 'Какие сведения нужно указать в обращении в поддержку Orion Demo?',
      },
      {
        tr: 'Orion Demo destek taleplerinde sırada, atandı ve incelendi durumları ne anlama gelir?',
        en: 'What do queued, assigned, and reviewed mean for Orion Demo support?',
        ar: 'ماذا تعني حالات قيد الانتظار ومُسنَد وتمت المراجعة في دعم Orion Demo؟',
        es: '¿Qué significan en cola, asignada y revisada en el soporte de Orion Demo?',
        pt: 'O que significam na fila, atribuída e revisada no suporte do Orion Demo?',
        ru: 'Что означают статусы «в очереди», «назначено» и «рассмотрено» в поддержке Orion Demo?',
      },
      {
        tr: 'Orion Demo çarşamba bakım incelemesi bir destek oturumu mudur?',
        en: 'Is the Orion Demo Wednesday maintenance review a support session?',
        ar: 'هل مراجعة الصيانة يوم الأربعاء في Orion Demo جلسة دعم؟',
        es: '¿La revisión de mantenimiento del miércoles de Orion Demo es una sesión de soporte?',
        pt: 'A revisão de manutenção de quarta-feira do Orion Demo é uma sessão de suporte?',
        ru: 'Является ли проверка обслуживания Orion Demo по средам сеансом поддержки?',
      },
      {
        tr: 'Orion Demo rezervasyonumu nasıl değiştiririm?',
        en: 'How do I change an Orion Demo reservation?',
        ar: 'كيف أغيّر حجزًا في Orion Demo؟',
        es: '¿Cómo cambio una reserva de Orion Demo?',
        pt: 'Como altero uma reserva do Orion Demo?',
        ru: 'Как изменить бронирование в Orion Demo?',
      },
    ],
  },
  {
    id: 'exports-archives',
    label: {
      tr: 'Dışa Aktarma ve Arşiv',
      en: 'Exports & Archives',
      ar: 'التصدير والأرشيف',
      es: 'Exportación y archivo',
      pt: 'Exportação e arquivo',
      ru: 'Экспорт и архивы',
    },
    questions: [
      {
        tr: 'Orion Demo alıştırması hangi dışa aktarma biçimlerini sunar?',
        en: 'What export formats does the Orion Demo exercise offer?',
        ar: 'ما صيغ التصدير المتاحة في تمرين Orion Demo؟',
        es: '¿Qué formatos de exportación ofrece el ejercicio de Orion Demo?',
        pt: 'Quais formatos de exportação o exercício do Orion Demo oferece?',
        ru: 'Какие форматы экспорта доступны в упражнении Orion Demo?',
      },
      {
        tr: 'Orion Demo dışa aktarma dosyaları çalışma alanındaki kayıtlar değişince güncellenir mi?',
        en: 'Do Orion Demo exports update when workspace records change?',
        ar: 'هل تُحدَّث الملفات المصدّرة من Orion Demo عند تغيير سجلات مساحة العمل؟',
        es: '¿Las exportaciones de Orion Demo se actualizan cuando cambian los registros del espacio de trabajo?',
        pt: 'As exportações do Orion Demo são atualizadas quando os registros do espaço de trabalho mudam?',
        ru: 'Обновляются ли экспортированные файлы Orion Demo при изменении записей в рабочем пространстве?',
      },
      {
        tr: 'Orion Demo alıştırma özeti çalışma alanının tam bir yedeği midir?',
        en: 'Is an Orion Demo exercise summary a complete workspace backup?',
        ar: 'هل ملخص تمرين Orion Demo نسخة احتياطية كاملة لمساحة العمل؟',
        es: '¿El resumen de un ejercicio de Orion Demo es una copia de seguridad completa del espacio de trabajo?',
        pt: 'O resumo de um exercício do Orion Demo é um backup completo do espaço de trabalho?',
        ru: 'Является ли сводка упражнения Orion Demo полной резервной копией рабочего пространства?',
      },
      {
        tr: 'Orion Demo arşivindeki alıştırma sonuç belgeleri ne kadar saklanır ve bu, deneme süresini uzatır mı?',
        en: 'How long are Orion Demo archive receipts kept, and does this extend the trial?',
        ar: 'كم تُحفظ إيصالات التمارين في أرشيف Orion Demo، وهل يمدد ذلك الفترة التجريبية؟',
        es: '¿Cuánto tiempo se conservan los comprobantes en el archivo de Orion Demo y se amplía así el período de prueba?',
        pt: 'Por quanto tempo os comprovantes ficam no arquivo do Orion Demo e isso estende o período de teste?',
        ru: 'Как долго хранятся подтверждения выполнения упражнений в архиве Orion Demo и продлевает ли это пробный период?',
      },
      {
        tr: 'Orion Demo arşivinden belge almak için kullanılan doğrulama ifadesi nedir?',
        en: 'What is the Orion Demo archive retrieval phrase?',
        ar: 'ما عبارة التحقق لاسترجاع إيصال من أرشيف Orion Demo؟',
        es: '¿Cuál es la frase de verificación para recuperar un comprobante del archivo de Orion Demo?',
        pt: 'Qual é a frase de verificação para recuperar um comprovante do arquivo do Orion Demo?',
        ru: 'Какая проверочная фраза используется для получения подтверждения из архива Orion Demo?',
      },
    ],
  },
];
