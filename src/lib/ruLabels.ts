const RU_LABELS: Record<string, string> = {
  passed: "Пройден", failed: "Не пройден", pending: "Ожидание",
  arrived: "На объекте", departed: "Убыл", on_shift: "На смене", expected: "Ожидается",
  day_off: "Выходной", sick_leave: "Больничный", vacation: "Отпуск", business_trip: "Командировка",
  archived: "В архиве", active: "Активен", inactive: "Не активен",
  issued: "Выдан", available: "Доступен", charging: "Зарядка", missing: "Утерян", returned: "Возвращён",
  normal: "Норма", damaged: "Повреждён", needs_repair: "Требует ремонта", maintenance: "Обслуживание",
  mine: "Рудничный", office: "Офисный", contractor: "Подрядчик", guest: "Гость", gov: "Гос.органы",
  rudnik: "Рудник",
  full: "Заполнена", partial: "Частично", free: "Свободна", occupied: "Занята", almost_full: "Почти занят",
  day: "Дневная", night: "Ночная", to_shift: "На смену", from_shift: "Со смены",
  pre_shift: "Предсменный", post_shift: "Послесменный",
  in: "Вход", out: "Выход",
  lantern: "Фонарь", rescuer: "Самоспасатель", both: "Фонарь и самоспасатель",
  valid: "Подтверждён", medical_issue: "Проблема с медосмотром", not_found: "Не найден", expired: "Просрочен",
};

export function ruLabel(val?: string | null) {
  if (!val) return "—";
  return RU_LABELS[val] || val;
}

export default ruLabel;
