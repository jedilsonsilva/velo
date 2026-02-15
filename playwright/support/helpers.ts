export function generateOrderCode() {
    const prefix = 'VLO';
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
   
    const randomChars = (conjunto, tamanho) =>
      Array.from({ length: tamanho }, () => conjunto[Math.floor(Math.random() * conjunto.length)]).join('');
  
    const parteNumeros = randomChars(numeros, 3);
    const parteLetras = randomChars(letras, 3);
  
    return `${prefix}-${parteNumeros}${parteLetras}`;
  }