import type { ReminderMessage } from "./reminderStateMachine.js";

/**
 * Mensagens das notificações. Tom leve e direto, em PT-BR. O título e a
 * descrição são montados aqui; os botões de ação são fixos e ficam no service
 * worker (frontend/public/sw.js).
 */

export function pre30(title: string): ReminderMessage {
  return {
    title: `⏰ Faltam 30 minutos`,
    description: `Daqui a pouco: ${title}. Bom momento pra se ajeitar e não sair correndo. 🙂`,
  };
}

export function pre5(title: string): ReminderMessage {
  return {
    title: `⏰ Faltam 5 minutos`,
    description: `Quase lá: ${title}. Já dá pra se preparar. 🙂`,
  };
}

export function atTime(title: string): ReminderMessage {
  return {
    title: `🔔 É agora!`,
    description: `Chegou a hora de ${title}. Abra o app pra concluir ou remarcar quando puder.`,
  };
}

export function nag(title: string): ReminderMessage {
  return {
    title: `👀 E aí, conseguiu?`,
    description: `Ainda lembrando de ${title}. Quando der, conclua ou remarque no app.`,
  };
}

export function snoozeReturn(title: string): ReminderMessage {
  return {
    title: `⏰ Voltei!`,
    description: `Você pediu pra eu lembrar de ${title} de novo. Aqui estou. 🙌`,
  };
}

export function nagStop(title: string): ReminderMessage {
  return {
    title: `😮‍💨 Vou parar de insistir`,
    description: `Não vou mais te lembrar de ${title} por aqui, mas ele continua pendente no app até você concluir.`,
  };
}

export function dayBefore(title: string): ReminderMessage {
  return {
    title: `📅 É amanhã!`,
    description: `Amanhã tem ${title}. Deixa tudo pronto hoje pra não ter correria. 😉`,
  };
}

export function dayOf(title: string): ReminderMessage {
  return {
    title: `🌅 Bom dia!`,
    description: `Hoje é dia de ${title}. Capricha! ✨`,
  };
}
