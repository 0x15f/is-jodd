export const site = {
  origin: 'https://howdoicalculateifanintegerisodd.com',
  name: 'Oddly Specific',
  domain: 'howdoicalculateifanintegerisodd.com',
  date: '2026-09-22',
  author: 'Jake Casto',
  github: 'https://github.com/0x15f/is-jodd',
};
export const categories = {
  learn: { name: 'Number basics', label: 'THE FUNDAMENTALS', description: 'Zero, negative numbers, very big integers. Start with the rules, then find the exceptions that aren’t exceptions.', color: 'orange' },
  code: { name: 'Write the code', label: 'THE PRACTICAL PART', description: 'Working examples in JavaScript, Python, SQL, spreadsheets, and more. Including the edge cases.', color: 'green' },
  jev: { name: 'The Jev lab', label: 'THE UNNECESSARY PART', description: 'What happens when you ask an AI to do arithmetic? API guides, a very odd npm package, and the actual benchmarks.', color: 'purple' },
};
export const articlePath = (article) => `/${article.category}/${article.slug}/`;
