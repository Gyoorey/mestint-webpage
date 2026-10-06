# assets/img — photographs

The figures of this course are original SVGs in `../fig/`. The photographs in this
folder come from **Wikimedia Commons** and are downloaded with a script rather than
shipped, so that every file arrives together with its licence record.

**To populate the folder** (once, on any computer with internet access):

    cd assets/img
    python3 fetch_images.py

The script reads `images.json`, downloads each photograph only if its licence is
public domain, CC0, CC BY or CC BY-SA, and writes `credits.json`. The web pages read
`credits.json` to show the author and licence under each photograph and on the
Credits page. A photograph that is not present is hidden automatically, so the site
works with or without this step.

To replace a photograph, put the Commons file title (e.g. `"File:Example.jpg"`) first
in its `titles` list in `images.json` and run the script again. Please check
`credits.json` afterwards — correct attribution is a condition of these licences.
