import { useEffect } from 'react';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { useOwnerEditionChoices } from '../queries/ownerEditionPickerQueries';

// Picker §§6-7: resume uses the scoped server flag; reading starts no search.
export function EditionChoicesReader({ identity, sessionId, candidateId, onChoices }: {
  identity: ImageInventoryIdentity; sessionId: string; candidateId: string;
  onChoices: (choices: EditionChoices) => void;
}) {
  const query = useOwnerEditionChoices(identity, sessionId, candidateId);
  useEffect(() => { if (query.data) onChoices(query.data); }, [query.data, onChoices]);
  return null;
}
