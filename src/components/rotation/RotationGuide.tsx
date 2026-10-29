import Icon from "@/components/ui/icon";

const STEPS = [
  {
    icon: "Building",
    title: "1. Подразделения и график",
    text: "Заведите участок ОГР, ОФ, ЭМС, АТЦ и другие службы. Для каждого — режим 60/60 (или свой), длительность пересменки и опорную дату заезда вахты «А». Все будущие даты система считает сама на год вперёд.",
  },
  {
    icon: "Split",
    title: "2. Схема смены",
    text: "«Полная смена» — две вахты, меняются целиком. «Со сдвигом половины» — четыре вахты, раз в ~30 дней меняется половина состава: на объекте всегда остаются люди, знающие текущую обстановку. Рекомендуется для ОГР и ключевых служб.",
  },
  {
    icon: "Wand2",
    title: "3. Автосборка составов",
    text: "Система берёт сотрудников из «Персонала» по подразделению и раскладывает по вахтам так, чтобы в каждой было поровну специалистов каждой должности (проходчиков, машинистов ПДМ, мастеров…). Ключевых людей закрепите звёздочкой — их не трогает перебалансировка.",
  },
  {
    icon: "Scale",
    title: "4. Нормативы укомплектованности",
    text: "Задайте минимум людей по должностям, который должен быть на объекте одновременно. С учётом отпусков, больничных и увольнений система заранее (на 120–180 дней) покажет даты и должности, где будет нехватка.",
  },
  {
    icon: "UserX",
    title: "5. Отсутствия",
    text: "Отпуска, больничные, обучение, командировки и увольнения. Отмечаются один раз — учитываются в графике, укомплектованности и готовности к заезду.",
  },
  {
    icon: "ClipboardCheck",
    title: "6. Подготовка перевахтовки",
    text: "За 2–3 недели открывайте карточку перевахтовки: список заезжающих и выезжающих, проблемы по каждому (пропуск истечёт, нет жилья, отпуск). Отмечайте «Подтверждён», «Билеты куплены», указывайте рейс/автобус. Печатайте списки для транспорта и КПП.",
  },
  {
    icon: "ScanLine",
    title: "7. Контроль по факту",
    text: "Отметка на КПП автоматически переводит человека в «Прибыл» или «Выехал». Кто не отметился после даты заезда — подсвечивается красным «Нет отметки на КПП».",
  },
  {
    icon: "FileSpreadsheet",
    title: "8. Графики и отчётность",
    text: "Диаграмма вахт по подразделениям и по людям, выгрузка табеля-графика в Excel: цветом отмечены вахта, отсутствия и дни заезда, второй лист — списки перевахтовок со статусами.",
  },
];

const CALENDAR = [
  { when: "За 30 дней", what: "Проверить составы и укомплектованность, внести отпуска; руководители подразделений подтверждают списки." },
  { when: "За 21 день", what: "Отдел кадров: продление пропусков и медосмотров, подбор замены на выпадающих." },
  { when: "За 14 дней", what: "Заказ билетов/автобусов, отметка «Билеты куплены», АХО готовит места в общежитиях." },
  { when: "За 3 дня", what: "Финальная проверка: все ли подтверждены, печать списков для транспорта и КПП." },
  { when: "День заезда", what: "КПП отмечает прибывших, медосмотр, ламповая; пересменка (передача дел) — 1 день." },
  { when: "+1 день", what: "Контроль неявок, отметка «Не явился», доукомплектование при нехватке." },
];

export default function RotationGuide() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <Icon name="Lightbulb" size={18} className="text-primary" />
          Стратегия перевахтовки для режима 2 месяца через 2
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Каждый работник принадлежит к одной вахте. Вахта живёт по циклу 120 дней: 60 на объекте, 60 дома. Две (или четыре) вахты сдвинуты так, чтобы
          объект никогда не оставался без нужного числа специалистов. Задача раздела — заранее собрать составы, увидеть нехватку и
          провести каждую перевахтовку по чек-листу с контролем по факту на КПП.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-4 flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name={s.icon} size={20} className="text-primary" fallback="Circle" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Регламент подготовки каждой перевахтовки</p>
        </div>
        <div className="divide-y divide-border">
          {CALENDAR.map((c) => (
            <div key={c.when} className="px-4 py-2.5 grid grid-cols-[120px_1fr] gap-3 text-sm">
              <span className="font-medium text-primary">{c.when}</span>
              <span className="text-foreground">{c.what}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Кто чем пользуется</p>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div><p className="font-medium text-foreground">Руководитель подразделения</p><p className="text-muted-foreground">Состав своих вахт, нормативы, баланс должностей, подтверждение списков.</p></div>
          <div><p className="font-medium text-foreground">Отдел кадров / перевахтовка</p><p className="text-muted-foreground">Отсутствия, графики, билеты и транспорт, печать списков, Excel.</p></div>
          <div><p className="font-medium text-foreground">КПП, АХО, медслужба</p><p className="text-muted-foreground">Отметки прибытия/выезда, жильё и медосмотр — подтягиваются в контроль автоматически.</p></div>
        </div>
      </div>
    </div>
  );
}
