import Segmented from "./Segmented";

const OPTIONS = [
  { value: "claro", label: "Claro", icon: "sun" },
  { value: "escuro", label: "Escuro", icon: "moon" },
];

export default function ThemeToggle({ theme, onChange }) {
  return <Segmented label="Tema" options={OPTIONS} value={theme} onChange={onChange} />;
}
