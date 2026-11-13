const rules = require('./assessments');

function questionType(value, options) {
  const text = String(value || '').toLowerCase();
  if (/pilihan|ganda|multiple/.test(text) || (!text && options?.length)) return 'Pilihan Ganda';
  if (/essay|esai|uraian/.test(text)) return 'Essay';
  return 'Isian Singkat';
}

// Merapikan keluaran AI (jenis soal, huruf pilihan, kunci) agar langsung bisa diedit di editor ulangan.
function normalizeGenerated(questions) {
  return (Array.isArray(questions) ? questions : []).map((question, index) => {
    const type = questionType(question?.type, question?.options);
    const options = type === 'Pilihan Ganda'
      ? (Array.isArray(question.options) ? question.options : []).map((option, i) => rules.optionText(String(option ?? ''), i).replace(/^[A-Fa-f][.)]\s*/, '')).slice(0, 6)
      : [];
    let correct = String(question?.correct ?? question?.answer ?? '');
    if (type === 'Pilihan Ganda') {
      const letter = /^\s*([A-Fa-f])(?:[.)]|\s|$)/.exec(correct)?.[1]?.toUpperCase();
      correct = (letter && rules.answerLetter(letter, options)) || rules.answerLetter(correct.trim(), options) || '';
    }
    const extra = [question?.source ? `Sumber: ${question.source}` : '', question?.difficulty ? `Tingkat: ${question.difficulty}` : ''].filter(Boolean).join(' · ');
    return { id: `generated-${index}`, type, text: String(question?.text || ''), options, correct, explanation: [String(question?.explanation || ''), extra].filter(Boolean).join('\n'), difficulty: question?.difficulty || '', source: question?.source || '' };
  });
}

module.exports = { normalizeGenerated, questionType };
