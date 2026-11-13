function factorPrime(value, prime) {
    let n = BigInt(value), power = 0, p = BigInt(prime);
    while (n !== 0n && n % p === 0n) { n /= p; power++; }
    return {unit: n, power};
}

function pTex(power) { return power === 0 ? "" : power === 1 ? "p" : `p^{${power}}`; }

function rational(text) {
    let match = String(text).trim().match(/^([+-]?\d+)(?:\s*\/\s*([+-]?\d+))?$/);
    if (!match) throw new Error("Enter a rational number.");
    let n = BigInt(match[1]), d = BigInt(match[2] || 1);
    if (d === 0n) throw new Error("The denominator must be nonzero.");
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b) [a, b] = [b, a % b];
    return {n: n/a, d: d/a, text: String(n/a) + (d/a === 1n ? "" : `/${d/a}`)};
}

function add(a, b) { return rational(`${a.n*b.d + b.n*a.d}/${a.d*b.d}`); }
function multiply(a, b) { return rational(`${a.n*b.n}/${a.d*b.d}`); }
function scale(values, k) { return values.map(value => multiply(rational(value), rational(k)).text); }

function fieldProduct(a, b, data) {
    let basis = data.coefficient_basis, out = basis.map(() => rational(0)), type = data.coefficient_field[0];
    if (type === "cyclotomic") {
        let linear = {3:-1, 4:0, 6:1}[data.coefficient_field[1]];
        if (basis.length !== 2 || basis[0] !== 0 || basis[1] !== 1 || linear === undefined) throw new Error("Unsupported coefficient basis.");
        let [a0, a1] = a.map(rational), [b0, b1] = b.map(rational), product = multiply(a1, b1);
        out[0] = add(multiply(a0, b0), multiply(product, rational(-1)));
        out[1] = add(add(multiply(a0, b1), multiply(a1, b0)), multiply(product, rational(linear)));
    } else if (type === "quadratic" || type === "multiquadratic") {
        for (let i = 0; i < basis.length; i++) for (let j = 0; j < basis.length; j++) {
            let product = Math.abs(basis[i]*basis[j]), factor = basis[i] < 0 && basis[j] < 0 ? -1 : 1;
            for (let k = 2; k*k <= product; k++) while (product % (k*k) === 0) { product /= k*k; factor *= k; }
            let index = basis.indexOf(basis[i]*basis[j] < 0 ? -product : product);
            if (index < 0) throw new Error("Coefficient basis is not closed under multiplication.");
            out[index] = add(out[index], multiply(multiply(rational(a[i]), rational(b[j])), rational(factor)));
        }
    } else throw new Error("Unsupported coefficient field.");
    return out.map(value => value.text);
}

function fieldValue(values, data, prime) {
    let nonzero = values.map(rational).filter(value => value.n !== 0n);
    let power = nonzero.length ? Math.max(0, Math.min(...nonzero.map(value =>
        factorPrime(value.n, prime).power - factorPrime(value.d, prime).power))) : 0;
    values = scale(values, `1/${BigInt(prime)**BigInt(power)}`);
    let terms = [];
    values.forEach((value, i) => {
        if (value === "0") return;
        let negative = value.startsWith("-"), magnitude = negative ? value.slice(1) : value;
        let basis = data.coefficient_basis[i];
        let symbol = data.coefficient_field[0] === "cyclotomic" ? (basis === 0 ? "" : `\\zeta_{${data.coefficient_field[1]}}${basis === 1 ? "" : `^{${basis}}`}`) : (basis === 1 ? "" : `\\sqrt{${basis}}`);
        let pFactor = nonzero.length === 1 ? pTex(power) : "";
        terms.push((negative ? "-" : terms.length ? "+" : "") + ((symbol || pFactor) && magnitude === "1" ? "" : numberTex(magnitude)) + pFactor + symbol);
    });
    let text = terms.join("") || "0";
    return {text: power && nonzero.length > 1 ? `${pTex(power)}\\left(${text}\\right)` : text,
            grouped: !power && terms.length > 1};
}

function fieldPolynomial(coefficients, p, data) {
    let terms = [];
    coefficients.forEach((values, degree) => {
        let first = values.map(rational).find(value => value.n !== 0n);
        if (!first) return;
        let negative = first.n < 0n, result = fieldValue(negative ? scale(values, -1) : values, data, p);
        let value = result.text;
        if (degree && value === "1") value = "";
        else if (degree && result.grouped) value = `\\left(${value}\\right)`;
        terms.push((negative ? "-" : terms.length ? "+" : "") + value + (degree ? "T" : "") + (degree > 1 ? `^{${degree}}` : ""));
    });
    return terms.join("") || "0";
}

function integerPolynomial(coefficients, p) {
    let terms = [];
    coefficients.forEach((value, degree) => {
        let integer = BigInt(value);
        if (integer === 0n) return;
        let negative = integer < 0n, part = factorPrime(negative ? -integer : integer, p);
        terms.push((negative ? "-" : terms.length ? "+" : "") +
            (part.unit === 1n && (degree || part.power) ? "" : String(part.unit)) + pTex(part.power) +
            (degree ? "T" : "") + (degree > 1 ? `^{${degree}}` : ""));
    });
    return terms.join("") || "0";
}

function eulerTex(entry, prime, data, factorizations, order) {
    let p = BigInt(prime);
    if (data.coefficient_field[0] !== "rational") {
        let factors = factorizations?.factorizations[String(prime)]?.[String(entry[0])];
        if (factors) return factors.map(f => `\\left(${fieldPolynomial(f.coefficients, p, data)}\\right)${f.multiplicity > 1 ? `^{${f.multiplicity}}` : ""}`).join("");
        let [_, a, b, epsilon] = entry;
        let one = data.coefficient_basis.map(value => data.coefficient_field[0] === "cyclotomic" ? (value === 0 ? "1" : "0") : (value === 1 ? "1" : "0"));
        return fieldPolynomial([one, a, scale(b, p), scale(fieldProduct(epsilon, a, data), p**3n), scale(fieldProduct(epsilon, epsilon, data), p**6n)], p, data);
    }
    let values = order === 1 ? [1, entry[1]] : order === 2 ? [1, entry[1], p] : order === 3 ? [1, entry[1], entry[2], BigInt(entry[3])*p**3n] :
        order === 5 ? [1, entry[1], p*BigInt(entry[2]), BigInt(entry[3])*p**3n*BigInt(entry[2]), BigInt(entry[3])*p**6n*BigInt(entry[1]), BigInt(entry[3])*p**10n] :
        [1, entry[1], p*BigInt(entry[2]), p**3n*BigInt(entry[1]), p**6n];
    let factors = CYIntegerFactor.factorIntegerPolynomial(values, p);
    return factors.length === 1 ? integerPolynomial(factors[0], p) : factors.map(factor => `\\left(${integerPolynomial(factor, p)}\\right)`).join("");
}

function inverseMod(value, p) {
    let [r, next, a, b] = [p, value, 0n, 1n];
    while (next) { let q = r/next; [r, next] = [next, r-q*next]; [a, b] = [b, a-q*b]; }
    if (r !== 1n) throw new Error("Denominator divisible by this prime.");
    return (a%p+p)%p;
}

function setupEuler(row, available) {
    let details = document.getElementById("euler");
    details.addEventListener("toggle", async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "1";
        let output = details.querySelector("div");
        try {
            let data = await readData(available.euler_factors);
            let factors = available.euler_factorizations ? await readData(available.euler_factorizations) : null;
            let infinity = new Map((data.infinity_euler_factors || []).map(([p, ...coefficients]) => [p, ["infinity", ...coefficients]]));
            let byPrime = new Map(data.euler_factors);
            for (let p of infinity.keys()) if (!byPrime.has(p)) byPrime.set(p, []);
            let blocks = [...byPrime].sort(([a], [b]) => a-b);
            let primes = blocks.map(([p, entries]) => [p, infinity.has(p) ? [...entries, infinity.get(p)] : entries]).filter(([, entries]) => entries.length).slice(0, 5);
            output.innerHTML = `<p><a href="data/${escapeText(available.euler_factors)}" download>Download Euler factors</a></p>` +
                `<label>Prime <select id="euler-prime">${primes.map(([p]) => `<option>${p}</option>`).join("")}</select></label>` +
                `<div id="euler-table"></div><form id="euler-fibre-form"><label>${infinity.size ? "Fibre z (or infinity)" : "Rational fibre z"} <input id="euler-fibre" value="1/2"></label> <button>Show Euler factors</button></form><div id="euler-fibre-table"></div>`;
            let table = (entries, perPrime = false) => '<table class="table"><thead><tr>' + (perPrime ? '<th>p</th>' : '') + '<th>z</th><th>Euler factor</th></tr></thead><tbody>' + entries.map(([p, entry]) =>
                `<tr>${perPrime ? `<td>${p}</td>` : ""}<td>${entry[0] === "infinity" ? math("\\infty") : entry[0]}</td><td>${math(eulerTex(entry, p, data, factors, row.degtheta))}</td></tr>`).join("") + '</tbody></table>';
            let prime = output.querySelector("#euler-prime"), result = output.querySelector("#euler-table");
            function showPrime() {
                let block = primes.find(([p]) => String(p) === prime.value);
                result.innerHTML = table(block ? block[1].map(entry => [block[0], entry]) : []);
                renderMath(result);
            }
            prime.addEventListener("change", showPrime);
            showPrime();
            output.querySelector("#euler-fibre-form").addEventListener("submit", event => {
                event.preventDefault();
                let target = output.querySelector("#euler-fibre-table");
                try {
                    let input = output.querySelector("#euler-fibre").value.trim(), selected = [];
                    if (input.toLowerCase() === "infinity" || input === "∞") {
                        target.innerHTML = table([...infinity].map(([p, entry]) => [p, entry]), true);
                        renderMath(target);
                        return;
                    }
                    let fibre = rational(input);
                    for (let [p, entries] of blocks) {
                        let mod = BigInt(p), denominator = (fibre.d % mod + mod) % mod;
                        if (!denominator) {
                            if (infinity.has(p)) selected.push([p, infinity.get(p)]);
                            continue;
                        }
                        let value = Number(((fibre.n % mod + mod) % mod)*inverseMod(denominator, mod)%mod);
                        let entry = entries.find(item => item[0] === value);
                        if (entry) selected.push([p, entry]);
                    }
                    target.innerHTML = table(selected, true);
                    renderMath(target);
                } catch (error) { target.textContent = error.message; }
            });
        } catch (error) { output.textContent = error.message; }
    });
}
