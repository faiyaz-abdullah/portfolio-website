/*
 * Site behaviour, shared by every page. Plain JavaScript, no dependencies.
 * Each block only runs when its elements are on the page.
 *
 *   1. Mobile menu
 *   2. Back-to-top button
 *   3. List search (publications, datasets, projects)
 *   4. Abstract / details toggles
 *   5. Blog: reading progress and contents highlight
 */
(function () {
    'use strict';

    // 1. Mobile menu
    var menu = document.querySelector('.overlay');
    var openButton = document.getElementById('trigger-overlay');

    if (menu && openButton) {
        var closeButton = menu.querySelector('.overlay-close');

        var setMenu = function (open) {
            menu.classList.toggle('open', open);
            document.body.classList.toggle('menu-open', open);
            openButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        };

        openButton.addEventListener('click', function () { setMenu(true); });
        if (closeButton) {
            closeButton.addEventListener('click', function () { setMenu(false); });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { setMenu(false); }
        });
    }

    // 2. Back-to-top button
    var toTop = document.getElementById('back-to-top');

    if (toTop) {
        var updateToTop = function () {
            toTop.classList.toggle('show', window.pageYOffset > 400);
        };
        window.addEventListener('scroll', updateToTop, { passive: true });
        toTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        updateToTop();
    }

    // 3. List search: <input data-filter="#list" data-filter-empty="#emptyMessage">
    [].forEach.call(document.querySelectorAll('[data-filter]'), function (input) {
        var scope = document.querySelector(input.getAttribute('data-filter'));
        var empty = document.querySelector(input.getAttribute('data-filter-empty'));
        if (!scope) { return; }

        var items = [].slice.call(scope.querySelectorAll('.pub-item'));
        var groups = [].slice.call(scope.querySelectorAll('.pub-group'));

        items.forEach(function (item) {
            item.setAttribute('data-haystack', item.textContent.toLowerCase().replace(/\s+/g, ' '));
        });

        input.addEventListener('input', function () {
            var q = input.value.trim().toLowerCase();
            var total = 0;

            items.forEach(function (item) {
                var hit = !q || item.getAttribute('data-haystack').indexOf(q) !== -1;
                item.style.display = hit ? '' : 'none';
                if (hit) { total++; }
            });

            // hide a whole group (e.g. "Workshop Papers") when none of its items match
            groups.forEach(function (group) {
                var visible = [].some.call(group.querySelectorAll('.pub-item'), function (item) {
                    return item.style.display !== 'none';
                });
                group.style.display = visible ? '' : 'none';
            });

            if (empty) { empty.style.display = total ? 'none' : 'block'; }
        });
    });

    // 4. Abstract / details toggles: <button class="pub-toggle" aria-controls="panelId">
    [].forEach.call(document.querySelectorAll('.pub-toggle'), function (button) {
        var panel = document.getElementById(button.getAttribute('aria-controls'));
        var label = button.querySelector('.pub-toggle-label');
        var base = label ? label.textContent : '';
        if (!panel) { return; }

        button.addEventListener('click', function () {
            var open = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', open ? 'false' : 'true');
            panel.hidden = open;
            if (label) { label.textContent = open ? base : 'hide ' + base; }
        });
    });

    // 5. Blog: reading progress bar and current-section highlight in the contents
    var article = document.querySelector('.article');
    var bar = document.getElementById('read-progress');
    var tocLinks = [].slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    var sections = tocLinks.map(function (link) {
        return document.getElementById(link.getAttribute('href').slice(1));
    }).filter(Boolean);

    if (article && (bar || sections.length)) {
        var onScroll = function () {
            if (bar) {
                var rect = article.getBoundingClientRect();
                var total = article.offsetHeight - window.innerHeight;
                var done = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
                bar.style.transform = 'scaleX(' + done + ')';
            }

            if (sections.length) {
                var current = sections[0].id;
                sections.forEach(function (section) {
                    if (section.getBoundingClientRect().top <= 140) { current = section.id; }
                });
                tocLinks.forEach(function (link) {
                    link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
                });
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();
    }
})();
