(function ($) {
    // Array Remove - By John Resig (MIT Licensed)
    Array.prototype.remove = function (from, to) {
        var rest = this.slice((to || from) + 1 || this.length);
        this.length = from < 0 ? this.length + from : from;
        return this.push.apply(this, rest);
    };

    // function to check if web storage is avaialable (from developer.mozilla.org)
    function storageAvailable(type) {
        try {
            var storage = window[type],
                x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        }
        catch (e) {
            return e instanceof DOMException && (
                // everything except Firefox
                e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === 'QuotaExceededError' ||
                // Firefox
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                // acknowledge QuotaExceededError only if there's something already stored
                storage.length !== 0;
        }
    };

        // We're going to be doing this in a mostly functional style as opposed to an
        // object-oriented one. Once the squares are assembled, the only relevant data about
        // them is whether they're clicked or not (which is best handled by a simple true/false
        // array) and which retort in the retorts list they correspond to (which is best handled
        // by carrying it in data-* DOM attributes). Building a bunch of Square objects might
        // make the code mildly neater, by some lights, but that small elegance gain is IMO
        // more than offset by the performance hit of maintaining all of that information in
        // memory needlessly.
        
        // (tl;dr: your author was playing with knockout.js all weekend, loved it, and feels weird
        // about loving it because her first Javascript mentor was sufficiently performance-obsessed
        // that he hated JQuery.)
        
        // of course, one of the disadvantages of structuring things this way is that it's a bit
        // harder to make the control flow self-documenting. ^^;; So - clicking on a square triggers
        // fillSquare; fillSquare fires checkForWin; checkForWin sometimes fires "win."

        // NEW STUFF: bingo card is now saved to browser local storage, which is then detected on 
        // load.  Need to write another function to re-generate squares from saved data
        // This will not be DRY, unless I add arguements to the generatrSquares function...
        // I could also separate square generation and card creation, so the card is built the same way
        // for both types of square generation.
        
    var grid = [[],[],[],[],[]],
        // Create an array of sqare data objects that can contain info for saving to web storage.
        squareData = [[],[],[],[],[]],
        winList,

        generateSquares = function (data) {
            var x, y,
                card = $('.card'),
                used_indices = [],
                sources = winList.find('li'),
                
                randomIndex = function() {
                    return Math.floor(Math.random() * sources.length);
                }
                
                randomSource = function () {
                    for(var index = randomIndex();
                        used_indices.indexOf(index) != -1;
                        index = randomIndex());
                    used_indices.push(index);
                    return $(sources[index]);
                },

                sectionTag = function (x, y, slug, content) {
                    return '<section class="square" id="' + x + '-' + y + '" data-slug="' + slug + '"><span>' + content + '</span></section>';
                },
                // Generate and save new squares
                generateNewSquares = function(){
                    eachGridElement(function (x, y) {
                        if (x === 2 && y === 2) {
                            grid[2][2] = true;
                            // Add free square to squareData array.
                            squareData[2][2] = {
                                title: "free-space",
                                comment: "An actually good, effective scene!",
                                response: ""
                            };
                        } else {
                            source = randomSource();
                            // Set up the isTicked grid.
                            grid[x][y] = false;
                            // Add data to the squareData array.
                            var newSquare = {
                                title: source.attr('data-slug'),
                                comment: source.find('.comment').html(),
                                response: source.find('.retort').html()
                            }
                            squareData[x][y] = newSquare;
                        }
                    });
                },
                // Read data from passed data object into arrays.
                readSquares = function(sqrData, grdData){
                    // Read element data and create squares from it.
                    eachGridElement(function(x, y){
                        // Set up the isTicked grid.
                        grid[x][y] = grdData[x][y];
                        // Read data into sqauredData
                        squareData[x][y] = sqrData[x][y];
                    });
                },               
                createCard = function(){
                    eachGridElement(function (x, y) {
                        card.append(sectionTag(x, y, squareData[x][y].title, squareData[x][y].comment));
                        // Check if the square is filled
                        if(grid[x][y]){
                            // Find the element based on the id tag.
                            var sqr = $('#' + x + '-' + y);
                            // Add filled class to element
                            sqr.addClass('filled');
                            // Add troll class to the matching element in winlist, which will be used to create the victory screen
                            winList.find('[data-slug="' + sqr.attr('data-slug') + '"]').addClass("troll");
                        }
                        

                    });
                };
            if(data){
                readSquares(data.squareData, data.filledData);
            } else {
                generateNewSquares();
            } 
            createCard();
        },

        // Maps the given function over a 5x5 set of indices
        eachGridElement = function (block) {
            for (x = 0; x < 5; x++) {
                for (y = 0; y < 5; y++) {
                    block(x, y);
                }
            }
        },

        // NOTE: This function is added to a click listener on each .square element.
        fillSquare = function (square) {
            var coords = square.attr('id').split('-');
            square.addClass('filled');
            winList.find('[data-slug="'+square.attr('data-slug')+'"]').addClass("troll");
            grid[coords[0]][coords[1]] = true;
            // just reset the entire string.
            localStorage.setItem('gridData', JSON.stringify(grid));

            checkForWin();
        },

        // right now we're checking for win by having a list of "win conditions" and evaluating
        // each in turn. A win condition is a function which traverses the grid and returns true
        // iff it finds that (at least one of) the lines (or other shapes) that it's checking
        // for is entirely composed of true squares. If/as soon as any of the win conditions
        // returns true, "win" is triggered.
        
        // This algorithm subject to revision if/when I think of a better approach - I like the
        // flexibility this gives but I hatehatehate the fact that it requires all squares to be
        // read multiple times. (note to self for future: try something with Array#push &
        // length-checking? or just incrementing a set of counters?)

        checkForWin = function () {
            var trueIfAllTrue = function (array) {
                    for (var x = 0; x < array.length; x++) {
                        if (!array[x]) {
                            return false;
                        }
                    }
                    return true;
                },
                winConditions = [
                // horizontal line
                function () {
                    for (var x = 0; x < 5; x++) {
                        if (trueIfAllTrue(grid[x])) {
                            return true;
                        }
                    }
                    return false;
                },
                // vertical line
                function () {
                    var count;
                    for (var y = 0; y < 5; y++) {
                        count = 0;
                        for (var x = 0; x < 5; x++) {
                            if (grid[x][y]) {
                                count++;
                            }
                        }
                        if (count === 5) {
                            return true;
                        }
                    }
                    return false;
                },
                // diagonals, part one (\)
                function () {
                    for (var i = 0; i < 5; i++) {
                        if (!grid[i][i]) {
                            return false;
                        }
                    }
                    return true;
                },
                // diagonals, part two (\)
                function () {
                    for (var i = 0; i < 5; i++) {
                        if (!grid[4 - i][i]) {
                            return false;
                        }
                    }
                    return true;
                }];

            for (i = winConditions.length - 1; i >= 0; i--) {
                if (winConditions[i]()) {
                    win();
                    break;
                }
            }
        },

        win = function () {
            $('body').addClass("won");
            $("html, body").animate({ scrollTop: 0 }, "fast");
            // Clear all stored data
            localStorage.clear();
        };

    $(document).ready(function () {

        winList = $('.win ul');

        // Check if localStorage is enabled
        if (storageAvailable('localStorage')) {
            console.log('Local Storage available!');
            // Check to see if partially completed bingo card is stored.
            if (localStorage.getItem('squareData') && localStorage.getItem('gridData')){
                // Create squares from stored values
                // Put into an object and then pass into generateSquares.
                var dat = {
                    squareData: JSON.parse(localStorage.getItem('squareData')),
                    filledData: JSON.parse(localStorage.getItem('gridData'))
                }
                generateSquares(dat);
            } else {
                // Generate new squares
                generateSquares();
                // Store the generated square data in local storage
                localStorage.setItem('squareData', JSON.stringify(squareData));
                // Store grid of filled squares in local storage.
                localStorage.setItem('gridData', JSON.stringify(grid));
            } 
        }
        else {
            console.log('Local storage is not available, too bad...');
            // Generate new squares, but don't bother saving to unavailable storage
            generateSquares();
        }
        // Add click listeners to all .square classes.
        $('.square').click(function () {
            fillSquare($(this));
        });
    });
})(jQuery);