import { preferenceText, type Preferences } from "@/lib/preferences";

export default function ItemPreferences({ value }: { value: Preferences }) {
  return (
    <div className="bl-item-preferences">
      <small>{preferenceText(value)}</small>
      {value.note && (
        <small className="bl-item-note">Ghi chú: {value.note}</small>
      )}
    </div>
  );
}
