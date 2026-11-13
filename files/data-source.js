const parameters = new URLSearchParams(location.search);
const previewRequested = parameters.has("preview");
const databaseRequested = parameters.has("database");
if (previewRequested) sessionStorage.setItem("cycluster-preview", "1");
if (databaseRequested) sessionStorage.removeItem("cycluster-preview");
const localDemo = ["127.0.0.1", "localhost"].includes(location.hostname) && location.port === "8765";
const preview = !databaseRequested && (location.hostname.endsWith("github.io") || previewRequested || localDemo || sessionStorage.getItem("cycluster-preview") === "1");
let catalogue;

if (preview && !location.hostname.endsWith("github.io")) {
    document.addEventListener("click", event => {
        let link = event.target.closest("a[href]");
        if (!link) return;
        let url = new URL(link.href, location.href);
        if (url.origin === location.origin && url.pathname.endsWith("/aesz.html")) {
            url.searchParams.set("preview", "1");
            link.href = url.href;
            if (link.dataset.originalHref) link.dataset.originalHref = url.href;
        }
    }, true);
}

function getCatalogue() {
    if (!catalogue) {
        let files = [1, 2, 3, 4].map(n => `theta_degree${n}_operators.json`);
        files.push("theta_degree5_operators_normalized.json");
        catalogue = Promise.all(files.map(name => fetch(`data/operators/${name}`).then(r => {
            if (!r.ok) throw new Error(`Cannot load ${name}`);
            return r.json();
        }))).then(groups => groups.flat());
    }
    return catalogue;
}

function getOperator(nn) {
    if (preview) return getCatalogue().then(rows => rows.filter(row => row.nn === nn));
    return fetch(`${apiurl}/operators?select=*&nn=eq.${encodeURIComponent(nn)}`).then(r => {
        if (!r.ok) throw new Error("Could not load the operator.");
        return r.json();
    }).then(rows => rows.map(row => row.catalogue_data || row));
}

function operatorLink(nn) {
    return `operator.html?nn=${encodeURIComponent(nn)}${preview && !location.hostname.endsWith("github.io") ? "&preview=1" : ""}`;
}

function matchesRule(row, rule) {
    if (rule.condition) {
        let tests = (rule.rules || []).map(child => matchesRule(row, child));
        return rule.condition === "AND" ? tests.every(Boolean) : tests.some(Boolean);
    }
    let exponents = row.riemann ? row.riemann.map(p => p.lexp.join(",")) :
        (row.singularity_factors || []).flatMap(p => Array(p.degree).fill(p.local_exponents.join(",")));
    if (!row.riemann && row.infinity_exponents) exponents.push(row.infinity_exponents.join(","));
    let actual = rule.field === "lexp_list" ? exponents : row[rule.field];
    let value = rule.value;
    if (rule.operator === "equal") return String(actual) === String(value);
    if (rule.operator === "not_equal") return String(actual) !== String(value);
    if (rule.operator === "like") return String(actual || "").toLowerCase().includes(String(value).toLowerCase());
    if (rule.operator === "is_null") return actual == null;
    if (rule.operator === "is_not_null") return actual != null;
    if (rule.operator === "is_empty") return actual != null && actual.length === 0;
    if (rule.operator === "is_not_empty") return actual != null && actual.length > 0;
    if (rule.operator === "nth_elem_is") return Array.isArray(actual) && String(actual[Number(value[0])]) === String(value[1]).trim();
    let items = String(value).replaceAll(" ", "").split(rule.field === "lexp_list" ? ";" : ",");
    let contains = item => Array.isArray(actual) && actual.map(String).includes(item);
    if (rule.operator === "contains") return items.every(contains);
    if (rule.operator === "not_contains") return !items.every(contains);
    if (rule.operator === "overlaps") return items.some(contains);
    if (rule.operator === "in") return items.includes(String(actual));
    if (rule.operator === "not_in") return !items.includes(String(actual));
    throw new Error(`Unsupported search condition: ${rule.operator}`);
}
