const rules = require('./assessments');
const publicContent = require('./public-content');

function answerText(question) {
  const answer = question.correct || question.answer || '';
  if (question.type !== 'Pilihan Ganda') return answer || 'Belum diisi';
  const options = question.options || [];
  const key = rules.answerLetter(answer, options);
  const index = key ? key.charCodeAt(0) - 65 : -1;
  return index >= 0 ? `${key}. ${rules.optionText(options[index], index)}` : answer || 'Belum diisi';
}

function printDocument(assessment, meta, kind) {
  if (!['soal', 'kunci'].includes(kind)) throw new Error('Jenis dokumen tidak valid.');
  // Whitelist the student sheet before it crosses the React client boundary.
  // Keys, explanations and unrelated assessment data never enter its HTML/props.
  return {
    kind, schoolName: publicContent.text(meta, 'schoolName'), address: publicContent.text(meta, 'address'),
    title: assessment.title || 'Ulangan', subject: assessment.subject || '', grade: assessment.grade || '', duration: assessment.duration || '',
    draft: assessment.status !== 'Siap digunakan',
    questions: assessment.questions.map((question, index) => ({
      number: index + 1, type: question.type || (question.options?.length ? 'Pilihan Ganda' : 'Isian Singkat'), text: question.text || '',
      options: question.type === 'Pilihan Ganda' || (!question.type && question.options?.length) ? (question.options || []).map(rules.optionText) : [],
      ...(kind === 'kunci' ? { answer: answerText(question), explanation: question.explanation || 'Pembahasan belum ditambahkan.' } : {}),
    })),
  };
}

module.exports = { printDocument };
