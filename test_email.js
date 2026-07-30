function processIdentifier(identifier) {
  let email = identifier.trim();
  if (email.toLowerCase() === 'admin') {
    email = 'admin@madrasa.local';
  } else if (!email.includes('@')) {
    const numericOnly = email.replace(/\D/g, '');
    if (numericOnly.length > 0) {
      email = `${numericOnly}@madrasa.local`;
    }
  }
  return email;
}
console.log(processIdentifier('01622460991'));
console.log(processIdentifier('01622460991 '));
console.log(processIdentifier(' 01622460991 '));
console.log(processIdentifier('+8801622460991'));
