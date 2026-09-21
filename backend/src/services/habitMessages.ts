/**
 * Mensagens dos avisos de hábito. Mesmo padrão de reminderMessages: título e
 * descrição saem daqui, os botões ficam no service worker.
 */

export interface HabitMessage {
  title: string;
  description: string;
}

export function habitNag(
  name: string,
  time: string,
  slotIndex: number,
  targetCount: number
): HabitMessage {
  const which = targetCount > 1 ? ` (${slotIndex + 1}ª de ${targetCount})` : "";
  return {
    title: `🎯 ${name}`,
    description: `Combinamos às ${time}${which}. Bora fechar esse check? 🙂`,
  };
}
