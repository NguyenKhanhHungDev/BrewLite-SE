export const SUGAR_LEVELS = [0, 50, 100] as const;
export const ICE_LEVELS = ['NONE', 'LESS', 'NORMAL'] as const;
export const MAX_NOTE_LENGTH = 200;

export type SugarLevel = (typeof SUGAR_LEVELS)[number];
export type IceLevel = (typeof ICE_LEVELS)[number];

// Missing/null values represent legacy lines without a recorded preference.
export interface OrderPreferences {
  sugarLevel?: SugarLevel | null;
  iceLevel?: IceLevel | null;
  note?: string | null;
}
