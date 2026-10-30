'use client';

// MoneyInput for state kept as a number (undefined = empty). It keeps what was
// typed ("12." / "12.50") while it still equals the number, so decimals can be
// typed; if the number is changed from outside, that new number is shown.
import { useState, type ComponentProps } from 'react';
import MoneyInput from '@/components/ui/MoneyInput';

type Props = Omit<ComponentProps<typeof MoneyInput>, 'value' | 'onValue'> & {
  value: number | null | undefined;
  onNumber: (n: number | undefined) => void;
};

const parse = (s: string): number | undefined => {
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export default function NumberMoneyInput({ value, onNumber, ...rest }: Props) {
  const [draft, setDraft] = useState('');
  const current = value === null || value === undefined ? undefined : value;
  const shown = parse(draft) === current ? draft : current === undefined ? '' : String(current);

  return (
    <MoneyInput
      {...rest}
      value={shown}
      onValue={(plain) => {
        setDraft(plain);
        onNumber(parse(plain));
      }}
    />
  );
}
