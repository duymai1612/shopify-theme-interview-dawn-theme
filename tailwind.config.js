/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './layout/*.liquid',
    './sections/*.liquid',
    './snippets/*.liquid',
    './templates/**/*.liquid',
    './assets/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Georgia', 'Times New Roman', 'serif'],
        'script': ['"Brush Script MT"', 'cursive']
      }
    }
  },
  plugins: []
};
