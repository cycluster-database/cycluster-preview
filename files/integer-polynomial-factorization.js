"use strict";

// Euler polynomials have constant coefficient 1 and prime-power leading
// coefficient. Gauss's lemma reduces their factorization to integer factors.
(function (root) {
  const abs = n => n < 0n ? -n : n;

  function squareRoot(n) {
    if (n < 0n) return null;
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    while (true) {
      const y = (x + n / x) / 2n;
      if (y >= x) return x * x === n ? x : null;
      x = y;
    }
  }

  function primePowers(n, p) {
    let rest = abs(n), power = 1n;
    const powers = [power];
    while (rest && rest % p === 0n) {
      rest /= p;
      power *= p;
      powers.push(power);
    }
    if (rest !== 1n) throw new Error("The Euler polynomial has a non-prime-power leading coefficient.");
    return powers;
  }

  function divideLinear(coefficients, linear) {
    const quotient = [coefficients[0]];
    for (let i = 1; i < coefficients.length - 1; i++)
      quotient.push(coefficients[i] - linear * quotient[i - 1]);
    return coefficients.at(-1) === linear * quotient.at(-1) ? quotient : null;
  }

  function quadraticSplit(c, p) {
    const powers = primePowers(c[4], p);
    const degree = powers.length - 1;
    for (let i = 0; i <= Math.floor(degree / 2); i++) {
      for (const sign of [1n, -1n]) {
        const q = sign * powers[i], r = sign * powers[degree - i];
        if (q * r !== c[4]) continue;
        let u, v;
        if (q === r) {
          if (c[3] !== q * c[1]) continue;
          const disc = squareRoot(c[1] * c[1] - 4n * (c[2] - q - r));
          if (disc === null || (c[1] + disc) % 2n !== 0n) continue;
          u = (c[1] + disc) / 2n;
        } else {
          const numerator = c[3] - q * c[1], denominator = r - q;
          if (numerator % denominator !== 0n) continue;
          u = numerator / denominator;
        }
        v = c[1] - u;
        if (u * v + q + r === c[2] && u * r + v * q === c[3])
          return [[1n, u, q], [1n, v, r]];
      }
    }
    return null;
  }

  function factorIntegerPolynomial(values, prime) {
    const p = BigInt(prime), original = values.map(BigInt), factors = [];
    let c = original.slice();
    while (c.length > 1 && c.at(-1) === 0n) c.pop();
    if (c[0] !== 1n || p < 2n) throw new Error("Expected a normalized Euler polynomial and a prime.");
    for (let d = 2n; d * d <= p; d++)
      if (p % d === 0n) throw new Error("The Euler factor label is not prime.");
    while (c.length > 1) {
      let found = false;
      for (const power of primePowers(c.at(-1), p)) {
        for (const sign of [1n, -1n]) {
          const u = sign * power, quotient = divideLinear(c, u);
          if (quotient) {
            factors.push([1n, u]);
            c = quotient;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) break;
    }
    if (c.length === 5) {
      const split = quadraticSplit(c, p);
      if (split) factors.push(...split);
      else factors.push(c);
    } else if (c.length > 1 || !factors.length) factors.push(c);
    return factors;
  }

  if (typeof module !== "undefined") module.exports = {factorIntegerPolynomial};
  if (root) root.CYIntegerFactor = {factorIntegerPolynomial};
})(typeof window === "undefined" ? null : window);
