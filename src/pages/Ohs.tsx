import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Icon from "@/components/ui/icon";
import OhsRegistry from "@/components/ohs/OhsRegistry";

interface Section {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
  shadow: string;
  available: boolean;
}

const sections: Section[] = [
  {
    id: "registry",
    title: "Реестр сотрудников",
    description: "Загрузка и просмотр Excel-реестров с автоматическими расчётами",
    icon: "Users",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/30",
    available: true,
  },
  {
    id: "briefings",
    title: "Инструктажи",
    description: "Журналы вводных, первичных и повторных инструктажей",
    icon: "BookOpen",
    gradient: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/30",
    available: false,
  },
  {
    id: "incidents",
    title: "Учёт происшествий",
    description: "Регистрация и расследование несчастных случаев",
    icon: "AlertTriangle",
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/30",
    available: false,
  },
  {
    id: "inspections",
    title: "Проверки и аудиты",
    description: "Графики проверок, предписания, устранение нарушений",
    icon: "ClipboardCheck",
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/30",
    available: false,
  },
  {
    id: "siz",
    title: "Учёт СИЗ",
    description: "Выдача и контроль средств индивидуальной защиты",
    icon: "HardHat",
    gradient: "from-cyan-500 to-sky-600",
    shadow: "shadow-cyan-500/30",
    available: false,
  },
  {
    id: "docs",
    title: "Документация",
    description: "Нормативные документы, приказы, положения по ОТ",
    icon: "FileStack",
    gradient: "from-rose-500 to-pink-600",
    shadow: "shadow-rose-500/30",
    available: false,
  },
];

export default function Ohs() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (activeSection === "registry") {
    return (
      <AppLayout title="ОТ и ПБ" subtitle="Реестр сотрудников">
        <button
          onClick={() => setActiveSection(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <Icon name="ArrowLeft" size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>Назад к разделам</span>
        </button>
        <OhsRegistry />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="ОТ и ПБ" subtitle="Охрана труда и промышленная безопасность">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotateX(0deg); }
          50% { transform: translateY(-8px) rotateX(2deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        .card-3d {
          perspective: 800px;
          transform-style: preserve-3d;
        }
        .card-3d-inner {
          transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
          transform-style: preserve-3d;
        }
        .card-3d:hover .card-3d-inner {
          transform: translateY(-12px) rotateX(5deg) rotateY(-2deg) scale(1.02);
        }
        .card-3d:active .card-3d-inner {
          transform: translateY(-4px) rotateX(2deg) scale(0.98);
        }
        .card-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }
        .card-float {
          animation: float 6s ease-in-out infinite;
        }
        .card-float:nth-child(2) { animation-delay: -1s; }
        .card-float:nth-child(3) { animation-delay: -2s; }
        .card-float:nth-child(4) { animation-delay: -3s; }
        .card-float:nth-child(5) { animation-delay: -4s; }
        .card-float:nth-child(6) { animation-delay: -5s; }
      `}</style>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-2">
        {sections.map((section) => (
          <div key={section.id} className="card-3d card-float">
            <button
              onClick={() => section.available && setActiveSection(section.id)}
              disabled={!section.available}
              className="w-full text-left"
            >
              <div
                className={`card-3d-inner relative rounded-2xl overflow-hidden ${
                  section.available
                    ? `cursor-pointer hover:${section.shadow}`
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-[0.07]`} />
                <div className="absolute inset-0 card-shimmer rounded-2xl" />

                <div className="relative bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-7 h-full">
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${section.gradient}`} />
                  </div>

                  <div className="flex items-start gap-5">
                    <div className="relative">
                      <div
                        className={`w-16 h-16 rounded-xl bg-gradient-to-br ${section.gradient} flex items-center justify-center shadow-lg ${section.shadow}`}
                        style={{
                          transform: "perspective(200px) rotateX(-5deg) rotateY(5deg)",
                          boxShadow: `0 12px 30px -8px var(--tw-shadow-color, rgba(0,0,0,0.3))`,
                        }}
                      >
                        <Icon name={section.icon} size={28} className="text-white drop-shadow-sm" />
                      </div>
                      {section.available && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-card">
                          <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground mb-1.5 leading-tight">
                        {section.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  {section.available ? (
                    <div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-400">
                      <span>Открыть раздел</span>
                      <Icon name="ArrowRight" size={16} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ) : (
                    <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground/60">
                      <Icon name="Lock" size={14} />
                      <span>Скоро появится</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
