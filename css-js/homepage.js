(function () {
    "use strict";

    // Keep the original JSONP files as the single source of publication facts.
    // Fetch them as text rather than executing a .json script (which can be
    // blocked by strict MIME policies). Never evaluate publication data as code.
    function decodePublications(source, callback) {
        const envelope = source.trim().match(/^([a-z]+)\s*\(([\s\S]*)\)\s*;?$/);
        if (!envelope || envelope[1] !== callback) {
            throw new Error("Unexpected publication data format");
        }
        // Matching complete JSON strings first preserves URLs, escapes and
        // punctuation in titles. Remove only legacy comments/trailing commas
        // outside strings, then let JSON.parse validate the actual data.
        const json = envelope[2]
            .replace(/("(?:\\.|[^"\\])*")|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,
                (match, string) => string === undefined ? "" : string)
            .replace(/("(?:\\.|[^"\\])*")|,\s*(?=[}\]])/g,
                (match, string) => string === undefined ? "" : string);
        const publications = JSON.parse(json);
        if (!Array.isArray(publications)) throw new Error("Publication data must be a list");
        return publications;
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function fileLink(file) {
        if (!file || typeof file.path !== "string" || typeof file.name !== "string") return null;
        let url;
        try {
            url = new URL(file.path, document.baseURI);
        } catch {
            return null;
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        const link = element("a", "", file.name);
        link.href = file.path;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        return link;
    }

    function publicationEntry(publication, type) {
        const item = element("li", "publication-entry");
        const article = element("article");
        const heading = element("h3", "publication-heading");
        const venue = type === "conference" ? publication.conference : publication.journal;
        heading.append(element("span", venue === "[arXiv]" ? "" : "publication-venue", venue));
        heading.append(document.createTextNode(" "), element("span", "publication-title", publication.title || ""));
        article.append(heading);

        const authors = element("p", "publication-authors");
        const names = Array.isArray(publication.authors) ? publication.authors : [];
        names.forEach((name, index) => {
            if (index) authors.append(document.createTextNode(", "));
            if (name === "Wangsong Yin" || name === "Wangsong Yin*") {
                authors.append(element("strong", "", name));
            } else {
                authors.append(document.createTextNode(String(name)));
            }
        });
        article.append(authors);

        const addition = type === "conference" ? publication.addtion || {} : publication;
        const fullname = type === "conference" ? publication.confernce_fullname : publication.journal_fullname;
        if (fullname && (type === "journal" || venue !== "[arXiv]")) {
            const detail = element("p", "publication-detail");
            if (type === "conference" && addition.rate) {
                detail.append(document.createTextNode(fullname + ". " + addition.rate + "."));
            } else {
                detail.append(element("em", "", fullname + "."));
            }
            if (addition.important_msg) {
                detail.append(element("strong", "publication-important", " " + addition.important_msg));
            }
            article.append(detail);
        }

        if (Array.isArray(addition.files) && addition.files.length) {
            const links = element("ul", "publication-links");
            links.setAttribute("aria-label", "Resources for " + (publication.title || "this publication"));
            addition.files.forEach(file => {
                const link = fileLink(file);
                if (link) {
                    const resource = element("li");
                    resource.append(link);
                    links.append(resource);
                }
            });
            article.append(links);
        }
        if (addition.msg) article.append(element("p", "publication-note", addition.msg));
        item.append(article);
        return item;
    }

    async function loadPublications(type, callback, path) {
        const list = document.getElementById(type + "-list");
        const status = document.getElementById(type + "-status");
        status.hidden = false;
        status.textContent = "Loading " + type + " publications…";
        list.setAttribute("aria-busy", "true");
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error("Publication data unavailable");
            const publications = decodePublications(await response.text(), callback);
            const fragment = document.createDocumentFragment();
            publications.filter(publication => publication && publication.show_selected)
                .forEach(publication => fragment.append(publicationEntry(publication, type)));
            list.replaceChildren(fragment);
            status.textContent = list.children.length ? "" : "No publications are listed yet.";
            status.hidden = Boolean(list.children.length);
        } catch {
            status.replaceChildren(document.createTextNode("The publication list could not be loaded. "));
            const retry = element("button", "retry-button", "Try again");
            retry.type = "button";
            retry.addEventListener("click", () => loadPublications(type, callback, path));
            const data = element("a", "", "View publication data");
            data.href = path;
            status.append(retry, data);
        } finally {
            list.setAttribute("aria-busy", "false");
        }
    }

    loadPublications("conference", "conferences", "./full-conference.json?callback=conferences");
    loadPublications("journal", "journals", "./full-journal.json?callback=journals");
}());
