import { classifyInteger } from './parity.mjs';

for (const form of document.querySelectorAll('[data-calculator]')) {
  const input = form.querySelector('input');
  const result = form.querySelector('[data-result]');
  const explanation = form.querySelector('[data-explanation]');
  const equation = form.querySelector('[data-equation]');
  const error = form.querySelector('[data-error]');
  function update() {
    const answer = classifyInteger(input.value);
    input.setAttribute('aria-invalid', String(!answer.valid));
    error.textContent = answer.valid ? '' : answer.error;
    if (!answer.valid) {
      result.textContent = 'Try again.';
      equation.textContent = '';
      explanation.textContent = 'Odd and even describe integers.';
      form.dataset.verdict = 'invalid';
      return;
    }
    form.dataset.verdict = answer.odd ? 'odd' : 'even';
    result.textContent = answer.odd ? 'Odd.' : 'Even.';
    explanation.textContent = `The last digit is ${answer.lastDigit}. ${answer.odd ? 'One is left over when you make pairs.' : 'It divides into pairs with nothing left over.'}`;
    equation.textContent = `${answer.normalized} = 2 × (${answer.quotient}) + ${answer.remainder}`;
    const dots = form.querySelector('[data-dots]');
    if (dots) dots.dataset.odd = String(answer.odd);
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); update(); });
  form.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.example; update(); }));
  update();
}

const search = document.querySelector('[data-search]');
if (search) {
  const cards = [...document.querySelectorAll('[data-article]')];
  const count = document.querySelector('[data-count]');
  const empty = document.querySelector('[data-empty]');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      const show = card.dataset.search.includes(query);
      card.hidden = !show;
      if (show) visible += 1;
    }
    count.textContent = `${visible} ${visible === 1 ? 'guide' : 'guides'}`;
    empty.hidden = visible !== 0;
  });
}

for (const pre of document.querySelectorAll('.article-body pre')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code example');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector('code').textContent);
      button.textContent = 'Copied';
    } catch { button.textContent = 'Select to copy'; }
    setTimeout(() => { button.textContent = 'Copy'; }, 2000);
  });
  pre.append(button);
}
