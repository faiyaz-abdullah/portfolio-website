/*
 * Site behaviour, shared by every page. Plain JavaScript, no dependencies.
 * Each block only runs when its elements are on the page.
 *
 *   1. Mobile menu
 *   2. Back-to-top button
 *   3. List search (publications, datasets, projects)
 *   4. Abstract / details toggles
 *   5. Blog: reading progress and contents highlight
 *   6. Blog: math rendering (pages that load KaTeX)
 *   7. Home: collaborators strip (drift, pause/play, previous/next)
 *   8. Home: news feed auto-scroll (hover to stop and scroll by hand)
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

    // 6. Blog: render the \( inline \) and \[ display \] math in the article.
    //    Only pages that load KaTeX (and its auto-render add-on) have renderMathInElement.
    if (article) {
        document.addEventListener('DOMContentLoaded', function () {
            if (!window.renderMathInElement) { return; }
            window.renderMathInElement(article, {
                delimiters: [
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            });
        });
    }

    // 7. Home: collaborators strip. The cards drift right to left; the buttons pause/play
    //    it and step one card back or forward. The list is in the track twice, so the
    //    position wraps around one list's width and the loop never shows a seam.
    //    Without this script the CSS animation drifts the strip and the buttons stay hidden.
    var strip = document.querySelector('.collab-marquee');
    var stripControls = document.querySelector('.collab-controls');

    if (strip && stripControls && window.requestAnimationFrame) {
        var track = strip.querySelector('.collab-track');
        var firstList = track.querySelector('.collab-list');
        var pauseButton = stripControls.querySelector('[data-collab="pause"]');
        var pauseIcon = pauseButton.querySelector('span');
        var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        var speed = 40;                 // drift speed, px per second
        var offset = 0;                 // how far the track has moved left, px
        var playing = !reducedMotion;   // reduced motion: start paused, step with the arrows
        var hovering = false;
        var glide = null;               // set while an arrow button moves the strip
        var lastTime = null;
        var frameId = null;

        var loopWidth = function () { return firstList.getBoundingClientRect().width; };
        var cardStep = function () {
            var card = firstList.querySelector('.collab-card');
            var gap = parseFloat(window.getComputedStyle(firstList).columnGap) || 0;
            return card ? card.getBoundingClientRect().width + gap : 0;
        };
        var wrap = function (x) {
            var w = loopWidth();
            return w ? ((x % w) + w) % w : 0;
        };
        var draw = function () {
            track.style.transform = 'translateX(' + (-wrap(offset)) + 'px)';
        };

        var frame = function (now) {
            var dt = lastTime === null ? 0 : Math.min(now - lastTime, 100) / 1000;
            lastTime = now;
            if (glide) {
                var t = Math.min(1, (now - glide.start) / glide.duration);
                offset = glide.from + (glide.to - glide.from) * (1 - Math.pow(1 - t, 3));
                if (t === 1) { glide = null; offset = wrap(offset); }
            } else if (playing && !hovering) {
                offset = wrap(offset + speed * dt);
            }
            draw();
            frameId = window.requestAnimationFrame(frame);
        };
        var start = function () {
            if (frameId === null) { lastTime = null; frameId = window.requestAnimationFrame(frame); }
        };
        var stop = function () {
            if (frameId !== null) { window.cancelAnimationFrame(frameId); frameId = null; }
        };

        var setPlaying = function (on) {
            playing = on;
            pauseButton.setAttribute('aria-label', on ? 'Pause scrolling' : 'Resume scrolling');
            pauseButton.setAttribute('aria-pressed', on ? 'false' : 'true');
            pauseIcon.className = on ? 'ion-pause' : 'ion-play';
        };
        var move = function (direction) {
            var to = (glide ? glide.to : offset) + direction * cardStep();
            if (reducedMotion) { glide = null; offset = wrap(to); draw(); return; }
            glide = { from: offset, to: to, start: window.performance.now(), duration: 450 };
        };

        stripControls.querySelector('[data-collab="prev"]').addEventListener('click', function () { move(-1); });
        stripControls.querySelector('[data-collab="next"]').addEventListener('click', function () { move(1); });
        pauseButton.addEventListener('click', function () { setPlaying(!playing); });
        strip.addEventListener('mouseenter', function () { hovering = true; });
        strip.addEventListener('mouseleave', function () { hovering = false; });

        // only animate while the strip is on screen
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) { start(); } else { stop(); }
            }).observe(strip);
        } else {
            start();
        }

        strip.classList.add('is-js');
        stripControls.hidden = false;
        setPlaying(playing);
        draw();
    }

    // 8. Home: the news feed scrolls itself slowly downward. At the bottom it waits,
    //    glides back to the top, waits, and starts again. Hovering (or touching, or
    //    tabbing into a link) stops it so the feed can be scrolled by hand as usual;
    //    afterwards it carries on from wherever it was left. Off for reduced motion.
    var feed = document.querySelector('.news-feed');
    var feedReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (feed && !feedReduced && window.requestAnimationFrame) {
        var feedSpeed = 22;             // px per second, a relaxed reading pace
        var feedPos = 0;                // where the script wants the feed, px (fractional)
        var feedWritten = 0;            // scrollTop right after the script last set it
        var feedMode = 'wait-top';      // 'down' | 'wait-bottom' | 'to-top' | 'wait-top'
        var feedUntil = 0;              // end of the current wait, or of the glide to the top
        var feedGlideFrom = 0;
        var feedHover = false, feedFocus = false, feedTouchUntil = 0;
        var feedLast = null, feedFrame = null;

        var feedFrameStep = function (now) {
            var dt = feedLast === null ? 0 : Math.min(now - feedLast, 100) / 1000;
            feedLast = now;
            var max = feed.scrollHeight - feed.clientHeight;
            if (feedUntil === 0) { feedUntil = now + 1500; }   // short pause before the first scroll

            // scrolled by hand (wheel, scrollbar, keys or touch): continue from there
            if (Math.abs(feed.scrollTop - feedWritten) > 1) {
                feedPos = feed.scrollTop;
                feedWritten = feed.scrollTop;
                feedMode = 'down';
            }

            var held = feedHover || feedFocus || now < feedTouchUntil;
            if (max > 0 && !held) {
                if (feedMode === 'down') {
                    feedPos = Math.min(max, feedPos + feedSpeed * dt);
                    if (feedPos >= max) { feedMode = 'wait-bottom'; feedUntil = now + 2500; }
                } else if (feedMode === 'wait-bottom' && now >= feedUntil) {
                    feedMode = 'to-top'; feedGlideFrom = feedPos; feedUntil = now + 1400;
                } else if (feedMode === 'to-top') {
                    var t = Math.min(1, 1 - (feedUntil - now) / 1400);
                    feedPos = feedGlideFrom * (1 - (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));
                    if (t >= 1) { feedPos = 0; feedMode = 'wait-top'; feedUntil = now + 2000; }
                } else if (feedMode === 'wait-top' && now >= feedUntil) {
                    feedMode = 'down';
                }
                feed.scrollTop = feedPos;
                feedWritten = feed.scrollTop;
            }
            feedFrame = window.requestAnimationFrame(feedFrameStep);
        };
        var feedStart = function () {
            if (feedFrame === null) { feedLast = null; feedFrame = window.requestAnimationFrame(feedFrameStep); }
        };
        var feedStop = function () {
            if (feedFrame !== null) { window.cancelAnimationFrame(feedFrame); feedFrame = null; }
        };

        feed.addEventListener('mouseenter', function () { feedHover = true; });
        feed.addEventListener('mouseleave', function () { feedHover = false; });
        feed.addEventListener('focusin', function () { feedFocus = true; });
        feed.addEventListener('focusout', function () { feedFocus = false; });
        feed.addEventListener('touchstart', function () { feedTouchUntil = Infinity; }, { passive: true });
        var feedTouchEnd = function () { feedTouchUntil = window.performance.now() + 4000; };
        feed.addEventListener('touchend', feedTouchEnd, { passive: true });
        feed.addEventListener('touchcancel', feedTouchEnd, { passive: true });

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) { feedStart(); } else { feedStop(); }
            }).observe(feed);
        } else {
            feedStart();
        }
    }
})();
