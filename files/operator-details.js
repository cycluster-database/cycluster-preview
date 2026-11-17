function escapeText(text) {
    return String(text ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
}

Object.assign(window.CYReferences, {
    COvS21: {authors:"Candelas, Philip and de la Ossa, Xenia and van Straten, Duco", title:"Local Zeta Functions From Calabi–Yau Differential Equations", year:"2021", url:"https://arxiv.org/abs/2104.07816"},
    COK24: {authors:"Candelas, Philip and de la Ossa, Xenia and Kuusela, Pyry", title:"Local Zeta Functions of Multiparameter Calabi–Yau Threefolds from the Picard–Fuchs Equations", year:"2026", url:"https://arxiv.org/abs/2405.08067"},
    JKK23: {authors:"Jockers, Hans and Kotlewski, Sören and Kuusela, Pyry", title:"Modular Calabi–Yau Fourfolds and Connections to M-Theory Fluxes", year:"2023", url:"https://arxiv.org/abs/2312.07611"},
    KLMS26: {authors:"Kuusela, Pyry and Lathwood, Michael and Mosso Rojas, Miroslava and Stepniczka, Michael", title:"Solutions of Calabi–Yau Differential Operators as Truncated p-adic Series and Efficient Computation of Zeta Functions", year:"2026", url:"https://arxiv.org/abs/2604.01191"}
});

function linkedText(text) {
    return String(text ?? '').split(/(\$[^$]*\$)/g).map((part, i) => i % 2 ? escapeText(part) : escapeText(part).replace(/\[([A-Za-z][A-Za-z0-9]+)\]|(?<![\w.])[1-5]\.\d+\.\d+(?![\w.])/g, (match, key) =>
        key ? `<a href="#ref-${key}">[${key}]</a>` : `<a href="${operatorLink(match)}">${match}</a>`)
        .replace(/Warning: [^.]*\./g, '<span class="warning">$&</span>')).join('');
}

function numberTex(value) {
    let text = String(value);
    let fraction = text.match(/^(-?)(\d+)\/(\d+)$/);
    return fraction ? `${fraction[1]}\\frac{${fraction[2]}}{${fraction[3]}}` : text;
}

function rhoTex(value) {
    let text = String(value);
    if (text === "0") return "0";
    let match = text.match(/^(-?\d+)(?:\/(\d+))?\*zeta\(3\)(?:\/(\d+))?$/);
    if (!match) return escapeText(text);
    let denominator = BigInt(match[2] || 1) * BigInt(match[3] || 1);
    let coefficient = denominator === 1n ? match[1] : `${match[1]}/${denominator}`;
    return `${coefficient === "1" ? "" : coefficient === "-1" ? "-" : numberTex(coefficient)}\\zeta(3)`;
}

function matrixTex(values) {
    return `\\begin{pmatrix}${values.map(row => row.map(value => numberTex(value).replaceAll("*", "\\,")).join("&")).join("\\\\")}\\end{pmatrix}`;
}

function singularityTex(data, index) {
    let value = data.singularities_tex?.[index] ||
        (String(data.singularities[index]).includes("Infinity") ? "\\infty" : numberTex(data.singularities[index]));
    return `z${value.startsWith("\\approx") ? "" : "="}${value}`;
}

function math(tex) { return `\\(${tex}\\)`; }
function displayMath(tex) { return `\\[${tex}\\]`; }
function renderMath(element) {
    renderMathInElement(element, {delimiters: [
        {left:"$$", right:"$$", display:true}, {left:"$", right:"$", display:false},
        {left:"\\(", right:"\\)", display:false}, {left:"\\[", right:"\\]", display:true}
    ]});
}

async function readData(path) {
    let response = await fetch(`data/${path}`);
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
}

function knowlButton(id, title) {
    return `<button type="button" class="knowl-button" data-knowl="${id}" aria-label="${title}" aria-expanded="false" title="${title}">&#9432;</button>`;
}

function bibliography(keys) {
    let entries = [...keys].filter(key => window.CYReferences[key]).map(key => {
        let ref = CYReferences[key];
        let title = ref.url ? `<a href="${escapeText(ref.url)}">${escapeText(ref.title)}</a>` : escapeText(ref.title);
        return `<li id="ref-${escapeText(key)}">[${escapeText(key)}] ${escapeText(ref.authors)}. <i>${title}</i>. ${escapeText(ref.publication || "")} ${escapeText(ref.year || "")}.</li>`;
    });
    return entries.length ? `<h4>References</h4><ul>${entries.join("")}</ul>` : "";
}

function relationText(relation) {
    let ids = (relation.operators || []).map(id => `<a href="${operatorLink(id)}">${escapeText(id)}</a>`).join(" and ");
    if (!ids) return "";
    if (relation.type === "hadamard_product") {
        let points = relation.expansion_points || [];
        let atZero = points.length && points.every(point => point.value === "0");
        let text = atZero ? `This operator is the Hadamard product of ${ids}, expanded at ${math("z=0")}.` :
            `This operator is obtained from the Hadamard product of ${ids}` + (points.length ? ` at ${points.map(point => math(`v=${point.tex}`)).join(" and ")}` : "") + ".";
        if (relation.local_coordinate_tex) text += ` Expand in ${math(relation.local_coordinate_tex)}.`;
        if (relation.coordinate_tex) text += ` After taking the product, set ${math(`z=${relation.coordinate_tex}`)}.`;
        return `<p>${text}</p>` + (relation.period_relation_tex ? displayMath(relation.period_relation_tex) : "");
    }
    if (relation.type === "equivalent") return `<p>This operator is equivalent to ${ids}.</p>` +
        (relation.coordinate_tex && relation.period_relation_tex ? displayMath(`w=${relation.coordinate_tex},\\qquad ${relation.period_relation_tex}`) : "");
    if (relation.type === "covering") return `<p>This operator is obtained from ${ids} by a quadratic covering and a gauge transformation.</p>` +
        displayMath(`${relation.coordinate_tex},\\qquad ${relation.period_relation_tex}`);
    if (relation.type === "coordinate_change") return `<p>This operator is obtained from ${ids} by ${math(relation.coordinate_tex)}` + (relation.gauge_tex ? ` and the gauge factor ${math(relation.gauge_tex)}` : "") + ".</p>";
    let labels = {symmetric_square: "This operator is the symmetric square of", exterior_square: "This operator is constructed from the exterior square of", exterior_square_construction: "The exterior square of this operator gives"};
    return `<p>${labels[relation.type] || "Related operator:"} ${ids}.</p>`;
}

function setupMonodromies(available) {
    let details = document.getElementById("monodromy");
    details.addEventListener("toggle", async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "1";
        try {
            let data = await readData(available.monodromies);
            let links = `<a href="data/${escapeText(available.monodromies)}" download>Download matrices</a>`;
            if (available.monodromy_paths) links += ` | <a href="data/${escapeText(available.monodromy_paths)}">View continuation paths</a>`;
            let basis = "";
            if (["covering", "logarithmic"].includes(data.basis?.kind)) {
                if (data.basis.kind === "covering") basis += `<p>The basis is obtained from ${linkedText(data.basis.parent_operator)} using ${math(data.basis.coordinate_tex)}.</p>`;
                basis += `<p>The matrices act on ${math("\\Pi_{\\mathbb Q}=B\\varpi")}, where ${math("\\varpi")} is the Frobenius basis period vector and</p>${displayMath(`B=${data.basis.basis_display_tex || data.basis.basis_matrix_tex}`)}`;
            }
            details.querySelector("div").innerHTML = links + basis + data.monodromy_matrices.map((matrix, i) =>
                `<p>Monodromy around ${math(singularityTex(data, i))}</p>` +
                displayMath(data.monodromy_matrices_tex?.[i] || matrixTex(matrix))).join("");
            renderMath(details);
        } catch (error) { details.querySelector("div").textContent = error.message; }
    });
}

async function setupIntegralMonodromies(available, refs, addRefs) {
    let data = await readData(available.integral_monodromies);
    let div = document.getElementById("integral-content");
    div.innerHTML = `<label><input type="checkbox" id="show-integral"> Show integral monodromy matrices</label> <a href="data/${escapeText(available.integral_monodromies)}" download>Download matrices</a><p>The displayed values of ${math("b")} and ${math("S")} are representatives modulo ${math("24")} and ${math("1")}.</p>` +
        `<div class="integral-table-scroll"><table class="integral-table"><thead><tr><th>Integral structure</th><th>Parameters ${knowlButton("integral-knowl", "Definition of the integral-basis parameters")}</th><th>Geometric realization</th></tr></thead><tbody>` +
        data.bases.map((basis, i) => {
            let p = basis.parameters;
            let kappa = basis.kappa_formula ? basis.kappa_formula.replaceAll("*", "\\,") : numberTex(p.kappa);
            addRefs(basis.description);
            (basis.references_list || []).forEach(key => refs.add(key));
            let epsilon = (basis.epsilon_tex || rhoTex(basis.epsilon)).replaceAll("\\!", "");
            let matrices = basis.monodromy_matrices.map((m, j) => `<span>${math(singularityTex(data, j))}${displayMath(matrixTex(m))}</span>`).join("");
            return `<tr><th scope="row">${basis.parameter ? "Family" : "Basis"} ${i+1}</th><td>${math(`\\kappa=${kappa},\\ N=${numberTex(p.N)},\\ S=${numberTex(p.S)},\\ b=${numberTex(p.b)},\\ \\sigma=${numberTex(p.sigma)},\\ \\epsilon=${epsilon}`)}${basis.parameter ? `, ${math("k\\in\\mathbb{Z}_{\\ge 0}")}` : ""}</td>` +
                `<td>${linkedText(basis.description || "Not identified.")}</td></tr><tr class="integral-matrices" hidden><td colspan="3"><div>${matrices}</div></td></tr>`;
        }).join("") + '</tbody></table></div>';
    div.querySelector("#show-integral").addEventListener("change", e => div.querySelectorAll(".integral-matrices").forEach(el => el.hidden = !e.target.checked));
}

async function renderExtra(row) {
    const extra = document.getElementById("extra-data");
    const end = document.getElementById("relations-and-references");
    const [coverage, definitions] = await Promise.all([
        readData("operators/coverage.json"), readData("page_definitions.json")
    ]);
    const available = coverage[row.nn] || {};
    const refs = new Set(row.references_list || []);
    const addRefs = text => [...String(text || "").matchAll(/\[([A-Za-z][A-Za-z0-9]+)\]/g)].forEach(m => refs.add(m[1]));
    addRefs(row.description);
    let content = "";
    if (row.Q_x_tex) content += `<h4>Associated second-order equation</h4>${displayMath(`u''(z)+Q(z)u(z)=0,\\quad Q(z)=${row.Q_x_tex.replaceAll("x", "z")}`)}`;
    content += '<h4>Rational Structure</h4>';
    if (row.rho != null && definitions.rational_structure[row.degtheta]) {
        let def = definitions.rational_structure[row.degtheta];
        let paragraph = available.monodromy_basis_note ? "After a logarithmic change of the Frobenius basis, the constant $\\rho$ appears in" : def.paragraphs[1];
        let formula = available.monodromy_basis_note ? def.period_basis_tex.replace("\\Pi_{\\mathbb{Q}}", "\\widetilde\\Pi").replace("\\varpi", "\\widetilde\\varpi") : def.period_basis_tex;
        content += `<h5>Rational Structure Constant ${knowlButton("rho-knowl", "Definition of the rational structure constant")}</h5>` +
            `<div id="rho-knowl" class="knowl-content" hidden><p>${def.paragraphs[0]}</p>${displayMath(def.frobenius_tex)}<p>${paragraph}</p>${displayMath(formula)}</div>` +
            `<p>${math(`\\rho=${row.rho_tex || rhoTex(row.rho)}`)}</p>`;
        if (available.monodromy_basis_note) content += `<p>${escapeText(available.monodromy_basis_note)}</p>`;
    }
    if (available.monodromies) content += `<details id="monodromy"><summary>${math("\\overline{\\mathbb{Q}}")} monodromy matrices</summary><div></div></details>`;
    if (available.euler_factors) {
        let usesDwork = !available.euler_factors_method || available.euler_factors_method.includes("Dwork");
        if (usesDwork) ["COvS21", "COK24", "JKK23", "KLMS26"].forEach(key => refs.add(key));
        content += `<details id="euler"><summary>Euler factors ${knowlButton("euler-knowl", "How Euler factors are computed")}</summary><div></div></details>`;
        let eulerMethod = available.euler_factors_method ? escapeText(available.euler_factors_method) : 'Euler factors are computed using the Dwork deformation method.';
        if (usesDwork) eulerMethod += ' See <a href="#ref-COvS21">[COvS21]</a>, <a href="#ref-COK24">[COK24]</a>, <a href="#ref-JKK23">[JKK23]</a> and <a href="#ref-KLMS26">[KLMS26]</a>.';
        content += `<div id="euler-knowl" class="knowl-content" hidden><p>${eulerMethod}</p></div>`;
    } else content += '<details><summary>Euler factors</summary><p>Euler factors are not available.</p></details>';
    if (row.degtheta === 4) content += '<h4>A-incarnations</h4>';
    if (row.degtheta === 4 && available.integral_monodromies) {
        let def = definitions.integral_parameters;
        let shift = available.integral_basis_shift_tex ? `<p>For this operator, the Frobenius basis in the following formula is first changed by ${math(available.integral_basis_shift_tex)}.</p>` : "";
        let formula = available.integral_basis_shift_tex ? def.period_basis_tex.replace("\\varpi", "\\widetilde\\varpi") : def.period_basis_tex;
        content += `<details id="integral"><summary>Integral structures</summary>` +
            `<div id="integral-knowl" class="knowl-content" hidden><p>${def.paragraphs[0]}</p>${displayMath(definitions.rational_structure[4].frobenius_tex)}${shift}<p>${def.paragraphs[1]} <a href="#ref-Sch25">[Sch25]</a>, <a href="#ref-KS23">[KS23]</a>, <a href="#ref-KKSS22">[KKSS22]</a></p>${displayMath(formula)}<p>${def.paragraphs[2]} See also <a href="#ref-PP25">[PP25]</a> for a more general integral basis ansatz.</p></div>`;
        if (available.integral_basis_shift_tex) content += `<p>The parameters use the Frobenius basis after the shift ${math(available.integral_basis_shift_tex)}.</p>`;
        content += '<div id="integral-content"></div></details>';
        ["Sch25", "KS23", "KKSS22", "PP25"].forEach(key => refs.add(key));
    } else if (row.degtheta === 4) {
        let message = available.integral_monodromy_status === "none" ? "No integral basis was found in the torsion-refined Gamma-class ansatz" + (available.integral_basis_shift_tex ? ` after the shift ${math(available.integral_basis_shift_tex)}` : "") + "." : "Integral monodromies are not available.";
        content += `<p>${message}</p>`;
    }
    if (Array.isArray(row.attractor_points) && row.attractor_points.length) {
        content += '<h4>Candidate attractor points</h4><ul>' + row.attractor_points.map(point => {
            let sources = (point.sources || []).map(source => { refs.add(source.key); return `<a href="#ref-${escapeText(source.key)}">[${escapeText(source.key)}]</a>`; }).join(", ");
            return `<li>${math(`z=${point.tex || numberTex(point.value)}`)} ${sources}</li>`;
        }).join("") + '</ul>';
    }
    let invariants = [["c3", "c_3"], ["c2h", "c_2\\cdot H"], ["h3", "H^3"], ["dim_h", "\\dim|H|"], ["c4", "c_4"], ["c3h", "c_3\\cdot H"], ["h4", "H^4"], ["c2h2", "c_2\\cdot H^2"]].filter(([key]) => row[key] != null);
    if (row.degtheta !== 4 && invariants.length) content += `<h4>Invariants of an A-incarnation</h4><p>${invariants.map(([key, label]) => math(`${label}=${numberTex(row[key])}`)).join(", ")}</p>`;
    if (row.monodromy_group) content += `<h4>Modular data</h4><p>${math(row.monodromy_group)}</p>`;
    extra.innerHTML = content;
    extra.addEventListener("click", event => {
        let button = event.target.closest("[data-knowl]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        let panel = document.getElementById(button.dataset.knowl);
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));
    });

    let relations = (row.operator_relations || []).map(relationText).join("");
    end.innerHTML = (relations ? `<h4>Relations to other operators</h4>${relations}` : "") + bibliography(refs);

    if (available.monodromies) setupMonodromies(available);
    if (available.integral_monodromies) {
        await setupIntegralMonodromies(available, refs, addRefs);
        end.innerHTML = (relations ? `<h4>Relations to other operators</h4>${relations}` : "") + bibliography(refs);
    }
    if (available.euler_factors) setupEuler(row, available);
}
